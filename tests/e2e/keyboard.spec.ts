import { createHmac } from "node:crypto";

import { expect, test } from "@playwright/test";
import postgres from "postgres";

/**
 * The admin side, by keyboard alone, at phone width.
 *
 * axe checks what is on the screen; it cannot check where focus goes. These
 * are the three places a keyboard or screen reader user gets lost: getting
 * past the navigation, knowing a new page has loaded, and getting out of the
 * menu drawer.
 */

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  const url = process.env.DATABASE_URL;
  const secret = process.env.SESSION_SECRET;
  if (!url || !secret) throw new Error("DATABASE_URL and SESSION_SECRET must be set.");
  const sql = postgres(url, { max: 1 });
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
});

test("the first Tab offers a way past the navigation", async ({ page }) => {
  await page.goto("/admin/menu");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
});

test("the menu opens by keyboard, lands on its links, and Escape hands focus back", async ({
  page,
}) => {
  await page.goto("/admin");
  const button = page.getByRole("button", { name: "Menu" });
  await expect(button).toHaveAttribute("aria-expanded", "false");

  await button.focus();
  await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(button).toBeFocused();
});

test("after following a link, focus is on the new page's heading", async ({ page }) => {
  await page.goto("/admin");
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("link", { name: "Orders", exact: true }).focus();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/admin\/orders$/);
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText("Orders");
  await expect(heading).toBeFocused();
});
