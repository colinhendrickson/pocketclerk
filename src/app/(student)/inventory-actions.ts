"use server";

import { revalidatePath } from "next/cache";

import {
  isChecklistKey,
  recordRemaining,
  setChecklistItem,
  setRestocked,
  type CountRow,
  listCount,
} from "@/lib/inventory";
import { assertPairedDevice } from "@/app/(student)/require-device";
import { getActiveShift } from "@/lib/queries";
import { getShiftSession } from "@/lib/session";

/**
 * Inventory and checklist actions.
 *
 * Every one resolves the session cookie to an open shift first. A student can
 * only ever count their own shift's inventory, which is the same scoping rule
 * the order actions use and for the same reason: students have no database
 * identity, so this layer is where it is enforced.
 */

async function currentShiftId(): Promise<string | null> {
  const shiftId = await getShiftSession();
  if (!shiftId) return null;
  const shift = await getActiveShift(shiftId);
  return shift?.id ?? null;
}

export type CountResult =
  | { ok: true; rows: CountRow[] }
  | { ok: false; error: "no_shift" | "invalid" };

/**
 * Records how many of an item are left.
 *
 * The upper bound is the starting quantity: a shift cannot end with more on the
 * cart than it began with, and the database refuses it anyway. Catching it here
 * turns a constraint violation into a sentence a student can act on.
 */
export async function countItem(
  itemId: string,
  remaining: number,
): Promise<CountResult> {
  await assertPairedDevice();
  const shiftId = await currentShiftId();
  if (!shiftId) return { ok: false, error: "no_shift" };
  if (!Number.isSafeInteger(remaining) || remaining < 0) {
    return { ok: false, error: "invalid" };
  }

  const rows = await listCount(shiftId);
  const row = rows.find((r) => r.itemId === itemId);
  if (!row || remaining > row.starting) return { ok: false, error: "invalid" };

  await recordRemaining(shiftId, itemId, remaining);
  revalidatePath("/shift/inventory");
  return { ok: true, rows: await listCount(shiftId) };
}

export async function markRestocked(
  itemId: string,
  restocked: boolean,
): Promise<CountResult> {
  await assertPairedDevice();
  const shiftId = await currentShiftId();
  if (!shiftId) return { ok: false, error: "no_shift" };

  await setRestocked(shiftId, itemId, restocked);
  revalidatePath("/shift/inventory");
  return { ok: true, rows: await listCount(shiftId) };
}

export type ChecklistResult =
  | { ok: true; done: string[] }
  | { ok: false; error: "no_shift" | "invalid" };

export async function toggleChecklistItem(
  key: string,
  done: boolean,
): Promise<ChecklistResult> {
  await assertPairedDevice();
  const shiftId = await currentShiftId();
  if (!shiftId) return { ok: false, error: "no_shift" };
  if (!isChecklistKey(key)) return { ok: false, error: "invalid" };

  const checklist = await setChecklistItem(shiftId, key, done);
  revalidatePath("/shift/clock-out");
  return { ok: true, done: checklist };
}
