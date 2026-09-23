import { createHmac } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

/**
 * Every screen, at every size the app has to work on.
 *
 * The first deployment was built for an iPad in landscape and opened on a
 * phone: the admin header was wider than the screen, so iOS zoomed the whole
 * page out, and the change amount, the one number that must always be
 * readable, was cut off at its edges. Neither shows up at the size the other
 * test runs at.
 *
 * So this walks each screen at a small phone, a large phone, a tablet in
 * portrait and in landscape, and a desktop, and checks the two things that
 * broke: nothing makes the page scroll sideways (DESIGN.md §3: "No horizontal
 * scroll at any width"), and the change amount fits inside its card. Admin
 * tables may scroll within their own card, which §3 allows; the page may not.
 *
 * It stops at the change screen rather than completing a sale, so it adds no
 * orders for the shift test to count.
 */

const SIZES = [
  { name: "small phone", width: 320, height: 640 },
  { name: "phone", width: 390, height: 844 },
  { name: "tablet portrait", width: 768, height: 1024 },
  { name: "tablet landscape", width: 1180, height: 820 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

const ADMIN_PAGES = ["", "/students", "/teachers", "/menu", "/orders", "/receipts"];

async function expectNoSidewaysScroll(page: Page, screen: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, `${screen} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);
}

/**
 * Signs the admin cookie the way the app does, so the admin pages can be
 * checked without an email round trip. The key is the test environment's own.
 */
async function signInAsAdmin(page: Page) {
  const url = process.env.DATABASE_URL;
  const secret = process.env.SESSION_SECRET;
  if (!url || !secret) throw new Error("DATABASE_URL and SESSION_SECRET must be set.");

  const sql = postgres(url, { max: 1 });
  const [admin] = await sql<{ person_id: string }[]>`SELECT person_id FROM admin_users LIMIT 1`;
  await sql.end();

  const signature = createHmac("sha256", secret).update(admin.person_id).digest("base64url");
  const base = test.info().project.use.baseURL ?? "http://localhost:3000";
  await page.context().addCookies([
    { name: "pocketclerk_admin", value: `${admin.person_id}.${signature}`, url: base },
  ]);
}

for (const size of SIZES) {
  test(`every screen fits a ${size.name} (${size.width}px)`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });

    await test.step("admin", async () => {
      await signInAsAdmin(page);
      for (const path of ADMIN_PAGES) {
        await page.goto(`/admin${path}`);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expectNoSidewaysScroll(page, `/admin${path}`);
      }
      await page.context().clearCookies();
    });

    await test.step("student sign-in", async () => {
      const code = process.env.DEVICE_CODE;
      if (code) await page.goto(`/setup?code=${encodeURIComponent(code)}`);
      await page.goto("/");
      await expectNoSidewaysScroll(page, "student list");

      await page.locator('a[href^="/pin/"]').first().click();
      await expect(page).toHaveURL(/\/pin\//);
      await expectNoSidewaysScroll(page, "PIN");
      for (const digit of ["1", "2", "3", "4"]) {
        await page.getByRole("button", { name: digit, exact: true }).click();
      }
      await expect(page).toHaveURL(/\/shift$/, { timeout: 20_000 });
      await expectNoSidewaysScroll(page, "shift dashboard");
    });

    await test.step("order, up to the change", async () => {
      await page.getByRole("button", { name: /Start classroom order/i }).click();
      await expect(page).toHaveURL(/\/shift\/order$/);
      await expectNoSidewaysScroll(page, "teacher picker");

      await page.locator("button:has(.card-body)").first().click();
      await page.getByRole("button", { name: /Add one Coffee$/i }).first().click();
      await expectNoSidewaysScroll(page, "order builder");

      await page.getByRole("button", { name: /Go to payment/i }).click();
      await page.getByRole("button", { name: /^\$20/ }).click();
      await expectNoSidewaysScroll(page, "change");

      // The whole figure is inside the card: nothing of it is cut off.
      const card = page.locator(".card", { hasText: "Give back" });
      const figure = card.locator(".tabular").first();
      const [cardBox, figureBox] = [await card.boundingBox(), await figure.boundingBox()];
      expect(cardBox && figureBox).toBeTruthy();
      expect(figureBox!.x).toBeGreaterThanOrEqual(cardBox!.x);
      expect(figureBox!.x + figureBox!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width);
    });

    await test.step("other shift screens", async () => {
      for (const path of ["/shift/orders", "/shift/inventory", "/shift/clock-out"]) {
        await page.goto(path);
        await expectNoSidewaysScroll(page, path);
      }
    });
  });
}
