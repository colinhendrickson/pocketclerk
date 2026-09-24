import { createHmac } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

/**
 * Staff change the main color, and the cart changes with it.
 *
 * The color math is unit-tested; this proves the seams: the page saves, the
 * layouts apply it on the student side too, and the site still passes axe in
 * the new color. It puts the original back afterwards.
 */

function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set.");
  return postgres(url, { max: 1 });
}

async function signIn(page: Page) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET must be set.");
  const sql = database();
  const [admin] = await sql<{ person_id: string }[]>`SELECT person_id FROM admin_users LIMIT 1`;
  await sql.end();
  const signature = createHmac("sha256", secret).update(admin.person_id).digest("base64url");
  await page.context().addCookies([
    {
      name: "pocketclerk_admin",
      value: `${admin.person_id}.${signature}`,
      url: test.info().project.use.baseURL ?? "http://localhost:3000",
    },
  ]);
}

function primaryOf(page: Page) {
  return page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim(),
  );
}

test.afterAll(async () => {
  const sql = database();
  await sql`UPDATE site_settings SET primary_color = NULL`;
  await sql.end();
});

test("a blue chosen on Colors is used on the cart, and reads well", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/colors");
  await page.waitForLoadState("networkidle");

  await page.getByRole("radio", { name: "Navy" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Easy to read" })).toBeVisible();
  await page.getByRole("button", { name: "Save color" }).click();
  await expect(page.getByText("Every page, including the cart, uses this color now.")).toBeVisible();

  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  // A student-side page, from a fresh request.
  await page.goto("/not-set-up");
  expect(await primaryOf(page)).toBe("#1e3a8a");

  await page.goto("/admin/colors");
  await page.getByRole("button", { name: "Back to the original teal" }).click();
  await expect(page.getByText("Back to the original teal. Every page uses it now.")).toBeVisible();
  await page.goto("/not-set-up");
  expect(await primaryOf(page)).toBe("#0b6e5f");
});

test("a color too light to read cannot be saved, and a darker shade is offered", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/colors");
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Color code").fill("#93c5fd");
  await expect(page.getByRole("status").filter({ hasText: "Too light" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save color" })).toBeDisabled();

  await page.getByRole("button", { name: /Use a darker shade/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "Easy to read" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save color" })).toBeEnabled();
});
