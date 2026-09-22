/**
 * Inventory rules, with no database behind them.
 *
 * Split from `inventory.ts` because the count screen is a client component. A
 * module that touches the database cannot be imported into the browser bundle,
 * and the arithmetic below is exactly the part both sides need. Keeping it pure
 * also makes it testable without a Postgres.
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
 * The end-of-shift tasks, from the client's specification.
 *
 * Defined in code rather than a table because they describe the job, not data
 * anyone edits day to day. Shifts store the keys they completed, so editing
 * this list never rewrites what a past shift actually did.
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

/**
 * Units used this shift: what was on the cart at the start, minus what is left.
 *
 * Derived rather than stored. A value that is both computed and saved is a
 * value that can end up disagreeing with itself, and this one has an obvious
 * single source.
 */
export function usedCount(row: CountRow): number | null {
  return row.remaining === null ? null : row.starting - row.remaining;
}

/** Units needed to bring an item back to par. Zero when it is already full. */
export function restockNeeded(row: CountRow): number {
  if (row.remaining === null) return 0;
  return Math.max(0, row.parLevel - row.remaining);
}

/** True once every item has a count. The restock list is meaningless before then. */
export function allCounted(rows: readonly CountRow[]): boolean {
  return rows.length > 0 && rows.every((row) => row.remaining !== null);
}
