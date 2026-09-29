import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db, getClient } from "@/db";
import { hashPin } from "@/lib/auth";
import { getMoneyLedger, listExpenses } from "@/lib/expenses";
import { pgError } from "@/lib/pg-errors";
import { EXPENSE_CATEGORIES } from "@/lib/validate";

/**
 * What the cart spends, and whether it is paying for itself. The ledger groups
 * sales and expenses by calendar month in the cart's time zone, so a late
 * evening order lands in the month staff saw it happen.
 */

const ZONE = "America/New_York";
// A month no other test writes to, so totals can be asserted exactly.
const MONTH = "2031-03";

let personId: string;
let studentId: string;
let teacherId: string;
let shiftId: string;

async function addExpense(spentOn: string, amountCents: number, active = true): Promise<string> {
  const [row] = await db.execute<{ id: string }>(sql`
    INSERT INTO expenses (spent_on, description, category, amount_cents, created_by, active)
    VALUES (${spentOn}::date, 'Ledger test', 'supplies', ${amountCents}, ${personId}, ${active})
    RETURNING id
  `);
  return row.id;
}

async function addOrder(createdAt: string, totalCents: number): Promise<void> {
  await db.execute(sql`
    INSERT INTO orders (shift_id, teacher_id, total_cents, payment_method, received_cents, change_cents, created_at)
    VALUES (${shiftId}, ${teacherId}, ${totalCents}, 'cash', ${totalCents}, 0, ${createdAt}::timestamptz)
  `);
}

beforeAll(async () => {
  const [person] = await db.execute<{ id: string }>(
    sql`INSERT INTO persons (name) VALUES ('Ledger Teacher') RETURNING id`,
  );
  personId = person.id;
  teacherId = person.id;
  await db.execute(sql`INSERT INTO teacher_profiles (person_id) VALUES (${teacherId})`);

  const [student] = await db.execute<{ id: string }>(
    sql`INSERT INTO students (display_name, pin_hash)
        VALUES (${`Ledger Student ${Date.now()}`}, ${await hashPin("1234")}) RETURNING id`,
  );
  studentId = student.id;
  const [shift] = await db.execute<{ id: string }>(
    sql`INSERT INTO shifts (student_id, clock_in, clock_out, hours_hundredths, reward_tickets)
        VALUES (${studentId}, '2031-03-01T13:00:00Z', '2031-03-01T15:00:00Z', 200, 2) RETURNING id`,
  );
  shiftId = shift.id;
});

afterAll(async () => {
  await db.execute(sql`DELETE FROM expenses WHERE created_by = ${personId}`);
  await db.execute(sql`DELETE FROM orders WHERE shift_id = ${shiftId}`);
  await db.execute(sql`DELETE FROM shifts WHERE id = ${shiftId}`);
  await db.execute(sql`DELETE FROM students WHERE id = ${studentId}`);
  await db.execute(sql`DELETE FROM teacher_profiles WHERE person_id = ${teacherId}`);
  await db.execute(sql`DELETE FROM persons WHERE id = ${personId}`);
  await getClient().end();
});

describe("expenses table", () => {
  it("accepts every category the app offers", async () => {
    for (const category of EXPENSE_CATEGORIES) {
      await db.execute(sql`
        INSERT INTO expenses (spent_on, description, category, amount_cents, created_by)
        VALUES ('2031-03-02', ${`Category ${category}`}, ${category}::expense_category, 100, ${personId})
      `);
    }
    const [row] = await db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM expenses WHERE created_by = ${personId} AND description LIKE 'Category %'`,
    );
    expect(row.n).toBe(EXPENSE_CATEGORIES.length);
    await db.execute(sql`DELETE FROM expenses WHERE created_by = ${personId}`);
  });

  it("refuses an amount of nothing", async () => {
    const error = await addExpense("2031-03-02", 0).then(
      () => null,
      (cause: unknown) => cause,
    );
    expect(pgError(error)?.constraint_name).toBe("expenses_amount_check");
  });
});

describe("listExpenses", () => {
  it("lists newest first with who logged it, including entries taken off", async () => {
    const older = await addExpense("2031-03-03", 500);
    const newer = await addExpense("2031-03-09", 700);
    const off = await addExpense("2031-03-05", 900, false);

    const rows = await listExpenses();
    const ids = rows.map((row) => row.id);
    expect(ids.indexOf(newer)).toBeLessThan(ids.indexOf(older));
    expect(ids).toContain(off);

    const row = rows.find((r) => r.id === newer);
    expect(row).toMatchObject({
      spentOn: "2031-03-09",
      description: "Ledger test",
      category: "supplies",
      amountCents: 700,
      note: null,
      loggedBy: "Ledger Teacher",
      active: true,
    });
    await db.execute(sql`DELETE FROM expenses WHERE created_by = ${personId}`);
  });
});

describe("getMoneyLedger", () => {
  it("groups sales and expenses by month, oldest first, with net and running net", async () => {
    await addExpense("2031-03-04", 2_000);
    await addExpense("2031-04-10", 300);
    await addOrder("2031-03-04T15:00:00Z", 1_250);
    await addOrder("2031-04-10T15:00:00Z", 900);

    const ledger = await getMoneyLedger(ZONE);
    const march = ledger.months.find((m) => m.month === MONTH);
    const april = ledger.months.find((m) => m.month === "2031-04");
    expect(march).toEqual({
      month: MONTH,
      soldCents: 1_250,
      spentCents: 2_000,
      netCents: -750,
      runningNetCents: expect.any(Number),
    });
    expect(april).toMatchObject({ soldCents: 900, spentCents: 300, netCents: 600 });
    expect(april!.runningNetCents - march!.runningNetCents).toBe(600);
    expect(ledger.months.indexOf(march!)).toBeLessThan(ledger.months.indexOf(april!));

    // Totals are the sum of every month.
    expect(ledger.soldCents).toBe(ledger.months.reduce((sum, m) => sum + m.soldCents, 0));
    expect(ledger.spentCents).toBe(ledger.months.reduce((sum, m) => sum + m.spentCents, 0));

    await db.execute(sql`DELETE FROM expenses WHERE created_by = ${personId}`);
    await db.execute(sql`DELETE FROM orders WHERE shift_id = ${shiftId}`);
  });

  it("leaves out expenses that were taken off", async () => {
    await addExpense("2031-03-04", 2_000, false);
    const ledger = await getMoneyLedger(ZONE);
    expect(ledger.months.find((m) => m.month === MONTH)?.spentCents ?? 0).toBe(0);
    await db.execute(sql`DELETE FROM expenses WHERE created_by = ${personId}`);
  });

  it("puts a late-evening sale in the month staff saw it, not the UTC month", async () => {
    // 10pm on March 31 in New York is 2am April 1 UTC.
    await addOrder("2031-04-01T02:00:00Z", 400);
    const ledger = await getMoneyLedger(ZONE);
    expect(ledger.months.find((m) => m.month === MONTH)?.soldCents).toBe(400);
    expect(ledger.months.find((m) => m.month === "2031-04")?.soldCents ?? 0).toBe(0);
    await db.execute(sql`DELETE FROM orders WHERE shift_id = ${shiftId}`);
  });
});
