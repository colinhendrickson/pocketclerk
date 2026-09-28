"use server";

import { revalidatePath } from "next/cache";

import {
  isChecklistKey,
  isValidCount,
  recordRemaining,
  setChecklistItem,
  setRestocked,
  type CountRow,
  listCount,
} from "@/lib/inventory";
import { assertPairedDevice } from "@/app/(student)/require-device";
import { getActiveShift } from "@/lib/queries";
import { getShiftSession } from "@/lib/session";
import { isUuid } from "@/lib/validate";

/**
 * Inventory and checklist actions. Each resolves the session cookie to an open
 * shift first, scoping students to their own shift's inventory (students have
 * no database identity, so this layer enforces it).
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
 * Records how many of an item are left. A count above the starting quantity is
 * valid: it means stock was added since the last count, and carries forward.
 */
export async function countItem(
  itemId: string,
  remaining: number,
): Promise<CountResult> {
  await assertPairedDevice();
  const shiftId = await currentShiftId();
  if (!shiftId) return { ok: false, error: "no_shift" };
  if (!isUuid(itemId) || !isValidCount(remaining)) return { ok: false, error: "invalid" };

  const rows = await listCount(shiftId);
  if (!rows.some((r) => r.itemId === itemId)) return { ok: false, error: "invalid" };

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
  if (!isUuid(itemId) || typeof restocked !== "boolean") return { ok: false, error: "invalid" };

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
