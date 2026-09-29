"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { expenses } from "@/db/schema";
import { parseActiveToggle, parseExpenseEdit, parseNewExpense } from "@/lib/validate";

import { requireAdmin } from "../require-admin";

/**
 * What the cart spends, logged by staff. Each action checks the admin session
 * itself: a server action is its own endpoint and does not pass through the
 * layout.
 */

export type ExpenseResult = { ok: true } | { ok: false; error: "invalid" | "not_found" };

const PAGE = "/admin/expenses";

export async function createExpense(input: unknown): Promise<ExpenseResult> {
  const admin = await requireAdmin();
  const parsed = parseNewExpense(input);
  if (!parsed) return { ok: false, error: "invalid" };

  await db.insert(expenses).values({ ...parsed, createdBy: admin.personId });

  revalidatePath(PAGE);
  return { ok: true };
}

/** Any admin may correct any entry; who logged it originally is kept. */
export async function updateExpense(input: unknown): Promise<ExpenseResult> {
  await requireAdmin();
  const parsed = parseExpenseEdit(input);
  if (!parsed) return { ok: false, error: "invalid" };

  const { id, ...fields } = parsed;
  const updated = await db
    .update(expenses)
    .set(fields)
    .where(eq(expenses.id, id))
    .returning({ id: expenses.id });
  if (updated.length === 0) return { ok: false, error: "not_found" };

  revalidatePath(PAGE);
  return { ok: true };
}

/** Taking an expense off leaves the ledger; the entry stays, marked. Nothing is deleted. */
export async function setExpenseActive(input: unknown): Promise<ExpenseResult> {
  await requireAdmin();
  const parsed = parseActiveToggle(input);
  if (!parsed) return { ok: false, error: "invalid" };

  const updated = await db
    .update(expenses)
    .set({ active: parsed.active })
    .where(eq(expenses.id, parsed.id))
    .returning({ id: expenses.id });
  if (updated.length === 0) return { ok: false, error: "not_found" };

  revalidatePath(PAGE);
  return { ok: true };
}
