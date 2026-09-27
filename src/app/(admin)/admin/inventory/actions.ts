"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { inventoryItems } from "@/db/schema";
import { isUniqueViolation } from "@/lib/pg-errors";
import { parseActiveToggle, parseNewSupply, parseSupplyEdit } from "@/lib/validate";

import { requireAdmin } from "../require-admin";

/**
 * Supplies the cart carries, counted by students at the end of each shift.
 * Each action checks the admin session itself: a server action is its own
 * endpoint and does not pass through the layout.
 */

export type SupplyResult = { ok: true } | { ok: false; error: "invalid" | "not_found" | "duplicate" };

const PAGE = "/admin/inventory";

export async function createSupply(input: unknown): Promise<SupplyResult> {
  await requireAdmin();
  const parsed = parseNewSupply(input);
  if (!parsed) return { ok: false, error: "invalid" };

  // New supplies go to the end of the list students count through.
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${inventoryItems.sortOrder}), 0)::int + 1` })
    .from(inventoryItems);

  try {
    await db.insert(inventoryItems).values({ ...parsed, sortOrder: next });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "duplicate" };
    throw error;
  }

  revalidatePath(PAGE);
  return { ok: true };
}

/**
 * Changing the full-cart amount affects the next shift's starting count only;
 * counts already open keep the amount they started with.
 */
export async function updateSupply(input: unknown): Promise<SupplyResult> {
  await requireAdmin();
  const parsed = parseSupplyEdit(input);
  if (!parsed) return { ok: false, error: "invalid" };

  try {
    const updated = await db
      .update(inventoryItems)
      .set({ name: parsed.name, unit: parsed.unit, parLevel: parsed.parLevel })
      .where(eq(inventoryItems.id, parsed.id))
      .returning({ id: inventoryItems.id });
    if (updated.length === 0) return { ok: false, error: "not_found" };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "duplicate" };
    throw error;
  }

  revalidatePath(PAGE);
  return { ok: true };
}

/** Taking a supply off hides it from the count; past counts keep it. Nothing is deleted. */
export async function setSupplyActive(input: unknown): Promise<SupplyResult> {
  await requireAdmin();
  const parsed = parseActiveToggle(input);
  if (!parsed) return { ok: false, error: "invalid" };

  try {
    const updated = await db
      .update(inventoryItems)
      .set({ active: parsed.active })
      .where(eq(inventoryItems.id, parsed.id))
      .returning({ id: inventoryItems.id });
    if (updated.length === 0) return { ok: false, error: "not_found" };
  } catch (error) {
    // Putting one back while an active supply has the same name.
    if (isUniqueViolation(error)) return { ok: false, error: "duplicate" };
    throw error;
  }

  revalidatePath(PAGE);
  return { ok: true };
}
