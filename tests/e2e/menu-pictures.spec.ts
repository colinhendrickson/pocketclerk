import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { database, signInAsAdmin } from "./helpers";

/**
 * Staff put a picture beside a name from the menu page, and can take it away.
 * What the student then sees is checked in shift.spec.ts.
 */

async function iconOf(name: string) {
  const sql = database();
  const [row] = await sql<{ icon: string | null }[]>`SELECT icon FROM addons WHERE name = ${name}`;
  await sql.end();
  return row?.icon ?? null;
}

test.beforeEach(async ({ page }) => {
  await signInAsAdmin(page);
});

test.afterAll(async () => {
  // Sweetener is seeded without a picture; leave it that way.
  const sql = database();
  await sql`UPDATE addons SET icon = NULL WHERE name = 'Sweetener'`;
  await sql.end();
});

test("a picture is chosen from the grid, saved, and taken away again", async ({ page }) => {
  await page.goto("/admin/menu");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Add a picture for Sweetener" }).click();
  const dialog = page.getByRole("dialog", { name: "Picture for Sweetener" });
  await expect(dialog).toBeVisible();

  const { violations } = await new AxeBuilder({ page })
    .include("dialog[open]")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  await dialog.getByRole("button", { name: /Sugar cube/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: /Change the picture for Sweetener, now Sugar cube/ })).toBeVisible();
  expect(await iconOf("Sweetener")).toBe("sugar");

  await page.getByRole("button", { name: /Change the picture for Sweetener/ }).click();
  await page.getByRole("dialog", { name: "Picture for Sweetener" }).getByRole("button", { name: "No picture" }).click();
  await expect(page.getByRole("button", { name: "Add a picture for Sweetener" })).toBeVisible();
  expect(await iconOf("Sweetener")).toBeNull();
});
