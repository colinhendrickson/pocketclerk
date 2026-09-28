import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { database, pairDevice } from "./helpers";

/**
 * A teacher pays with a staff card (3.7). Card payments are off by default, so
 * this turns them on for the run and marks every teacher as usually paying by
 * card, then puts both back. The server refuses card orders while the switch is
 * off, so the switch is set in the database rather than only in the page.
 *
 * Assumes a seeded database (`pnpm seed`). Every seeded PIN is 1234.
 */

const PIN = ["1", "2", "3", "4"];
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

let preferred: string[] = [];

test.beforeAll(async () => {
  const sql = database();
  await sql`UPDATE site_settings SET card_payments_enabled = true`;
  const rows = await sql<{ person_id: string }[]>`
    UPDATE teacher_profiles SET prefers_card = true
    WHERE prefers_card = false RETURNING person_id`;
  preferred = rows.map((r) => r.person_id);
  await sql.end();
});

test.afterAll(async () => {
  const sql = database();
  await sql`UPDATE site_settings SET card_payments_enabled = false`;
  if (preferred.length > 0) {
    await sql`UPDATE teacher_profiles SET prefers_card = false WHERE person_id IN ${sql(preferred)}`;
  }
  await sql.end();
});

test("a teacher pays with a staff card, and no change is made", async ({ page }) => {
  await test.step("sign in", async () => {
    await pairDevice(page);
    await page.goto("/cart");
    await page.locator('a[href^="/pin/"]').first().click();
    for (const digit of PIN) {
      await page.getByRole("button", { name: digit, exact: true }).click();
    }
    await expect(page).toHaveURL(/\/shift$/, { timeout: 20_000 });
  });

  await test.step("build an order", async () => {
    await page.getByRole("button", { name: /Start classroom order/i }).click();
    await expect(page).toHaveURL(/\/shift\/order$/);
    await page.locator("button:has(.card-body)").first().click();
    await page.getByRole("button", { name: /Add one Coffee$/i }).first().click();
    await page.getByRole("button", { name: /Go to payment/i }).click();
  });

  await test.step("the payment choice asks, and suggests without choosing", async () => {
    await expect(page.getByRole("heading", { name: /How is .+ paying\?/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Cash$/ })).toBeVisible();
    const card = page.getByRole("button", { name: /Staff card/ });
    await expect(card).toContainText("Usually pays by card");
    // Neither choice is the highlighted default.
    await expect(page.locator(".btn-primary").filter({ hasNotText: "Skip to content" })).toHaveCount(0);

    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  await test.step("back returns to the choice, then the card is checked", async () => {
    await page.getByRole("button", { name: /Staff card/ }).click();
    await expect(page.getByRole("heading", { name: /Ask .+ for their staff card/ })).toBeVisible();
    await page.getByRole("button", { name: "Back to how they pay" }).click();
    await expect(page.getByRole("heading", { name: /How is .+ paying\?/ })).toBeVisible();

    await page.getByRole("button", { name: /Staff card/ }).click();
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    await page.getByRole("button", { name: "Scan card" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Reading card" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Approved" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Paid by staff card" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { name: "Change given" })).toHaveCount(0);
  });

  await test.step("today's orders marks it as a card sale", async () => {
    await page.getByRole("button", { name: /Back to your shift/i }).click();
    await page.getByRole("button", { name: /Today.s orders/i }).click();
    await expect(page).toHaveURL(/\/shift\/orders$/);
    await expect(page.getByText(/Paid by staff card/).first()).toBeVisible();
  });
});
