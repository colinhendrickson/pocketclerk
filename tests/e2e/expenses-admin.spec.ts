import { expect, test } from "@playwright/test";

import { database, signInAsAdmin } from "./helpers";

/** Staff log what the cart spends, correct it, and take it off. */

const description = `E2E Coffee pots ${Date.now()}`;

test.beforeEach(async ({ page }) => {
  await signInAsAdmin(page);
});

test.afterAll(async () => {
  const sql = database();
  await sql`DELETE FROM expenses WHERE description = ${description}`;
  await sql.end();
});

test("an expense is logged, changed and taken off, and the ledger follows", async ({ page }) => {
  await page.goto("/admin/expenses");
  await page.waitForLoadState("networkidle");

  const spentBefore = await page.locator('[data-tour="money"] .stat').nth(1).textContent();

  const form = page.locator('[data-tour="add-expense"]');
  await form.getByLabel("Date").fill("2026-09-01");
  await form.getByLabel("What").fill(description);
  await form.getByLabel("Category").selectOption("equipment");
  await form.getByLabel("Amount in dollars").fill("89.99");
  await form.getByRole("button", { name: "Add expense" }).click();

  const row = page.getByRole("row").filter({ hasText: description });
  await expect(row).toContainText("Equipment");
  await expect(row).toContainText("$89.99");
  await expect(page.locator('[data-tour="money"] .stat').nth(1)).not.toHaveText(spentBefore ?? "");

  await row.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel(`Amount in dollars for ${description}`).fill("79.99");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("row").filter({ hasText: description })).toContainText("$79.99");

  await page
    .getByRole("row")
    .filter({ hasText: description })
    .getByRole("button", { name: "Take off" })
    .click();
  await expect(page.getByRole("row").filter({ hasText: description })).toContainText("Taken off");

  const sql = database();
  const [saved] = await sql<{ amount_cents: number; active: boolean; category: string }[]>`
    SELECT amount_cents, active, category FROM expenses WHERE description = ${description}`;
  await sql.end();
  expect(saved).toEqual({ amount_cents: 7999, active: false, category: "equipment" });
});
