import { expect, test } from "@playwright/test";

import { database, signInAsAdmin } from "./helpers";

/** Staff add, change and take off the supplies students count at the end of a shift. */

const name = `E2E Lids ${Date.now()}`;

test.beforeEach(async ({ page }) => {
  await signInAsAdmin(page);
});

test.afterAll(async () => {
  const sql = database();
  await sql`DELETE FROM inventory_items WHERE name = ${name}`;
  await sql.end();
});

test("a supply is added, changed and taken off", async ({ page }) => {
  await page.goto("/admin/inventory");
  await page.waitForLoadState("networkidle");

  const form = page.locator('[data-tour="add-supply"]');
  await form.getByLabel("Supply").fill(name);
  await form.getByLabel("Counted in").fill("lids");
  await form.getByLabel("Full cart").fill("40");
  await form.getByRole("button", { name: "Add supply" }).click();

  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toContainText("lids");
  await expect(row).toContainText("40");

  await row.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel(`Full cart amount for ${name}`).fill("60");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("row").filter({ hasText: name })).toContainText("60");

  await page.getByRole("row").filter({ hasText: name }).getByRole("button", { name: "Take off" }).click();
  await expect(page.getByRole("row").filter({ hasText: name })).toContainText("Not counted");

  const sql = database();
  const [saved] = await sql<{ par_level: number; active: boolean }[]>`
    SELECT par_level, active FROM inventory_items WHERE name = ${name}`;
  await sql.end();
  expect(saved).toEqual({ par_level: 60, active: false });
});
