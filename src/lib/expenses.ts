import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { expenses, persons } from "@/db/schema";
import { withRunningNet, type MonthMoneyRow } from "@/lib/money";
import { TIME_ZONE, type LocalDate } from "@/lib/time";
import type { ExpenseCategory } from "@/lib/validate";

/**
 * What the cart spends, and the ledger that sets it against sales so staff can
 * see whether the cart is paying for itself.
 */

export interface ExpenseRow {
  id: string;
  spentOn: LocalDate;
  description: string;
  category: ExpenseCategory;
  amountCents: number;
  note: string | null;
  /** The admin who logged it. */
  loggedBy: string;
  active: boolean;
  createdAt: Date;
}

/** Every expense, newest purchase first. Entries taken off are included, marked. */
export async function listExpenses(): Promise<ExpenseRow[]> {
  return db
    .select({
      id: expenses.id,
      spentOn: expenses.spentOn,
      description: expenses.description,
      category: expenses.category,
      amountCents: expenses.amountCents,
      note: expenses.note,
      loggedBy: persons.name,
      active: expenses.active,
      createdAt: expenses.createdAt,
    })
    .from(expenses)
    .innerJoin(persons, eq(persons.id, expenses.createdBy))
    .orderBy(desc(expenses.spentOn), desc(expenses.createdAt));
}

export interface MoneyLedger {
  soldCents: number;
  spentCents: number;
  /** Every month with a sale or an expense, oldest first. */
  months: MonthMoneyRow[];
}

/**
 * Sales and expenses by calendar month. Sales are grouped in the cart's time
 * zone, so an evening order counts toward the month staff saw it happen.
 * Expenses carry the day staff wrote, which needs no conversion.
 */
export async function getMoneyLedger(timeZone: string = TIME_ZONE): Promise<MoneyLedger> {
  const rows = await db.execute<{ month: string; sold: number; spent: number }>(sql`
    WITH sold AS (
      SELECT to_char(created_at AT TIME ZONE ${timeZone}, 'YYYY-MM') AS month,
             sum(total_cents)::int AS cents
      FROM orders
      GROUP BY 1
    ),
    spent AS (
      SELECT to_char(spent_on, 'YYYY-MM') AS month,
             sum(amount_cents)::int AS cents
      FROM expenses
      WHERE active
      GROUP BY 1
    )
    SELECT coalesce(sold.month, spent.month) AS month,
           coalesce(sold.cents, 0)::int AS sold,
           coalesce(spent.cents, 0)::int AS spent
    FROM sold
    FULL OUTER JOIN spent ON sold.month = spent.month
    ORDER BY 1
  `);

  const months = withRunningNet(
    rows.map((row) => ({ month: row.month, soldCents: row.sold, spentCents: row.spent })),
  );
  return {
    soldCents: months.reduce((sum, month) => sum + month.soldCents, 0),
    spentCents: months.reduce((sum, month) => sum + month.spentCents, 0),
    months,
  };
}
