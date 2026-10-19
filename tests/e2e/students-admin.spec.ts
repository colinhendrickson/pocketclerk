import { expect, test } from "@playwright/test";

import { database, signInAsAdmin } from "./helpers";

/**
 * Staff fix a student's name (4.22) and start a new pay period after
 * paychecks (4.23). The student keeps their shifts; the roster's hours count
 * again from zero and the finished period is listed below.
 */

const stamp = Date.now();
const firstName = `E2E Avery ${stamp}`;
const fullName = `E2E Avery Lastname ${stamp}`;
let studentId: string;
const startedAt = new Date();

test.beforeAll(async () => {
  const sql = database();
  const [student] = await sql<{ id: string }[]>`
    INSERT INTO students (display_name, pin_hash, active) VALUES (${firstName}, 'unused', false) RETURNING id`;
  studentId = student.id;
  // A finished 2.5-hour shift from yesterday, so the roster has hours to show.
  await sql`
    INSERT INTO shifts (student_id, clock_in, clock_out, hours_hundredths, reward_tickets)
    VALUES (${studentId}, now() - interval '1 day 2 hours 30 minutes', now() - interval '1 day', 250, 2)`;
  await sql.end();
});

test.beforeEach(async ({ page }) => {
  await signInAsAdmin(page);
});

test.afterAll(async () => {
  const sql = database();
  // Periods this run started, newest first: each one is referenced by the next.
  for (;;) {
    const deleted = await sql`
      DELETE FROM pay_periods
       WHERE started_at >= ${startedAt}
         AND id NOT IN (SELECT previous_id FROM pay_periods WHERE previous_id IS NOT NULL)
      RETURNING id`;
    if (deleted.length === 0) break;
  }
  await sql`DELETE FROM shifts WHERE student_id = ${studentId}`;
  await sql`DELETE FROM students WHERE id = ${studentId}`;
  await sql.end();
});

test("a student's name is corrected and keeps their hours", async ({ page }) => {
  await page.goto("/admin/students");
  await page.waitForLoadState("networkidle");

  const row = page.getByRole("row").filter({ hasText: firstName });
  await row.getByRole("button", { name: "Edit name" }).click();
  const input = page.getByLabel(`New name for ${firstName}`);
  await input.fill(fullName);
  const save = page.getByRole("button", { name: "Save name" });
  await expect(save).toBeEnabled();
  await page.screenshot({ path: "docs/screenshots/student-edit-name.png" });
  await save.click();

  const renamed = page.getByRole("row").filter({ hasText: fullName });
  await expect(renamed).toBeVisible();
  await expect(renamed).toContainText("2.50");
});

test("a new pay period starts the hours again and keeps the old ones", async ({ page }) => {
  await page.goto("/admin/students");
  await page.waitForLoadState("networkidle");

  const panel = page.locator('[data-tour="pay-period"]');
  await panel.getByRole("button", { name: "Start new pay period" }).click();
  await expect(panel).toContainText("Start a new pay period now?");
  await page.screenshot({ path: "docs/screenshots/pay-period-confirm.png" });
  await panel.getByRole("button", { name: "Yes, start a new pay period" }).click();
  await expect(panel.getByRole("status")).toContainText("A new pay period has started");

  // This period: no shifts, no hours. All time: unchanged.
  const cells = page.getByRole("row").filter({ hasText: fullName }).getByRole("cell");
  await expect(cells.nth(2)).toHaveText("0");
  await expect(cells.nth(3)).toHaveText("0.00");
  await expect(cells.nth(4)).toHaveText("2.50");

  const past = page.locator('[data-tour="past-pay-periods"]');
  await past.locator("summary").first().click();
  await expect(past.getByRole("row").filter({ hasText: fullName })).toContainText("2.50");
  await page.screenshot({ path: "docs/screenshots/pay-periods.png", fullPage: true });
});
