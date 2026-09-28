/**
 * Pure inventory rules, split from `inventory.ts` so the client-side count
 * screen can import them without pulling in the database.
 */

export interface CountRow {
  itemId: string;
  name: string;
  unit: string;
  parLevel: number;
  starting: number;
  /** Null until the student has counted this item. */
  remaining: number | null;
  restocked: boolean;
}

/**
 * End-of-shift tasks. Shifts store the completed keys, so editing this list
 * does not rewrite past shifts.
 */
export const CHECKLIST = [
  { key: "inventory", label: "Inventory counted" },
  { key: "restocked", label: "Items restocked" },
  { key: "cleaned", label: "Coffee cart cleaned" },
  { key: "money", label: "Pretend money put away" },
  { key: "orders", label: "All orders finished" },
  { key: "tidy", label: "Work area organized" },
] as const;

export type ChecklistKey = (typeof CHECKLIST)[number]["key"];

export function isChecklistKey(value: unknown): value is ChecklistKey {
  return typeof value === "string" && CHECKLIST.some((e) => e.key === value);
}

/** Upper bound on a count, matching the largest par level staff can set. */
export const MAX_COUNT = 9_999;

/** A count arrives from the browser, so it must be a whole number in range. */
export function isValidCount(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MAX_COUNT
  );
}

/** Keeps the stepper in range. Counts above the start are allowed (restocked since). */
export function clampCount(next: number): number {
  return Math.max(0, Math.min(MAX_COUNT, next));
}

/**
 * Units used this shift. Derived, never stored. Floored at zero because a count
 * above the start means stock was added, not negative usage.
 */
export function usedCount(row: CountRow): number | null {
  return row.remaining === null ? null : Math.max(0, row.starting - row.remaining);
}

/** Units added since the last count, e.g. a teacher refilled cups between shifts. */
export function addedCount(row: CountRow): number | null {
  return row.remaining === null ? null : Math.max(0, row.remaining - row.starting);
}

/** Units needed to bring an item back to par. Zero when it is already full. */
export function restockNeeded(row: CountRow): number {
  if (row.remaining === null) return 0;
  return Math.max(0, row.parLevel - row.remaining);
}

/** True once every item has a count. */
export function allCounted(rows: readonly CountRow[]): boolean {
  return rows.length > 0 && rows.every((row) => row.remaining !== null);
}
