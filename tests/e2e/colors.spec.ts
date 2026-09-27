import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { database, signInAsAdmin } from "./helpers";

/**
 * Staff change the main color, and the cart changes with it.
 *
 * The color math is unit-tested; this proves the seams: the page saves, the
 * layouts apply it on the student side too, and the site still passes axe in
 * the new color. It puts the original back afterwards.
 */

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
  await signInAsAdmin(page);
  await page.goto("/admin/colors");
  await page.waitForLoadState("networkidle");

  await page.getByRole("radio", { name: "Navy" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Easy to read" })).toBeVisible();
  await page.getByRole("button", { name: "Save color" }).click();
  await expect(page.getByText("Every page, including the cart, uses this color now.")).toBeVisible();
  // Saving refreshes the whole layout. In CI with React 19.3, axe ran while
  // the page's <title> was not yet back. The title must come back; axe runs
  // once it has, rather than in the gap, and this fails if it never does.
  await expect(page).toHaveTitle("PocketClerk");

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
  await signInAsAdmin(page);
  await page.goto("/admin/colors");
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Color code").fill("#93c5fd");
  await expect(page.getByRole("status").filter({ hasText: "Too light" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save color" })).toBeDisabled();

  await page.getByRole("button", { name: /Use a darker shade/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "Easy to read" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save color" })).toBeEnabled();
});
