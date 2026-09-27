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

/** Units used this shift (starting minus remaining). Derived, never stored. */
export function usedCount(row: CountRow): number | null {
  return row.remaining === null ? null : row.starting - row.remaining;
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
