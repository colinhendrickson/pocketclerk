import { and, asc, desc, eq, isNotNull, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { inventoryCounts, inventoryItems, shifts } from "@/db/schema";
import type { ChecklistKey, CountRow } from "@/lib/inventory-rules";

// Server modules import everything from here; client code imports the rules
// module directly.
export {
  CHECKLIST,
  isChecklistKey,
  restockNeeded,
  usedCount,
  allCounted,
  type ChecklistKey,
  type CountRow,
} from "@/lib/inventory-rules";

/**
 * End-of-shift inventory. The student counts what is left; the app derives
 * usage and restock needs. Remaining is never inferred from sales, since
 * counting is the teaching goal.
 */

/**
 * Opens the count for a shift, creating a row per active item on first visit.
 * The starting quantity (previous shift's leftover, or par) is snapshotted
 * onto the row so later par changes do not rewrite it.
 */
export async function openCount(shiftId: string): Promise<CountRow[]> {
  const items = await db
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.active, true))
    .orderBy(asc(inventoryItems.sortOrder), asc(inventoryItems.name));

  const existing = await db
    .select({ itemId: inventoryCounts.itemId })
    .from(inventoryCounts)
    .where(eq(inventoryCounts.shiftId, shiftId));
  const have = new Set(existing.map((row) => row.itemId));

  const missing = items.filter((item) => !have.has(item.id));
  if (missing.length > 0) {
    const starts = await Promise.all(
      missing.map((item) => startingFor(shiftId, item.id, item.parLevel)),
    );
    await db.insert(inventoryCounts).values(
      missing.map((item, i) => ({
        shiftId,
        itemId: item.id,
        starting: starts[i],
      })),
    );
  }

  return listCount(shiftId);
}

async function startingFor(
  shiftId: string,
  itemId: string,
  parLevel: number,
): Promise<number> {
  const [previous] = await db
    .select({
      remaining: inventoryCounts.remaining,
      restocked: inventoryCounts.restocked,
    })
    .from(inventoryCounts)
    .innerJoin(shifts, eq(shifts.id, inventoryCounts.shiftId))
    .where(
      and(
        eq(inventoryCounts.itemId, itemId),
        ne(inventoryCounts.shiftId, shiftId),
        isNotNull(inventoryCounts.remaining),
      ),
    )
    .orderBy(desc(shifts.clockIn))
    .limit(1);

  if (!previous || previous.remaining === null) return parLevel;
  // Restocked items went back to par; otherwise carry over the last count.
  return previous.restocked ? parLevel : previous.remaining;
}

export async function listCount(shiftId: string): Promise<CountRow[]> {
  return db
    .select({
      itemId: inventoryItems.id,
      name: inventoryItems.name,
      unit: inventoryItems.unit,
      parLevel: inventoryItems.parLevel,
      starting: inventoryCounts.starting,
      remaining: inventoryCounts.remaining,
      restocked: inventoryCounts.restocked,
    })
    .from(inventoryCounts)
    .innerJoin(inventoryItems, eq(inventoryItems.id, inventoryCounts.itemId))
    .where(eq(inventoryCounts.shiftId, shiftId))
    .orderBy(asc(inventoryItems.sortOrder), asc(inventoryItems.name));
}

export async function recordRemaining(
  shiftId: string,
  itemId: string,
  remaining: number,
): Promise<void> {
  await db
    .update(inventoryCounts)
    .set({ remaining, countedAt: new Date() })
    .where(
      and(
        eq(inventoryCounts.shiftId, shiftId),
        eq(inventoryCounts.itemId, itemId),
      ),
    );
}

export async function setRestocked(
  shiftId: string,
  itemId: string,
  restocked: boolean,
): Promise<void> {
  await db
    .update(inventoryCounts)
    .set({ restocked })
    .where(
      and(
        eq(inventoryCounts.shiftId, shiftId),
        eq(inventoryCounts.itemId, itemId),
      ),
    );
}

/** Atomically adds or removes one completed checklist key. */
export async function setChecklistItem(
  shiftId: string,
  key: ChecklistKey,
  done: boolean,
): Promise<string[]> {
  const [row] = await db.execute<{ checklist: string[] }>(
    done
      ? sql`UPDATE shifts
             SET checklist = (
               SELECT array_agg(DISTINCT c)
               FROM unnest(checklist || ARRAY[${key}]::text[]) AS c
             )
             WHERE id = ${shiftId}
             RETURNING checklist`
      : sql`UPDATE shifts
             SET checklist = array_remove(checklist, ${key})
             WHERE id = ${shiftId}
             RETURNING checklist`,
  );
  return row?.checklist ?? [];
}

export async function getChecklist(shiftId: string): Promise<string[]> {
  const [row] = await db
    .select({ checklist: shifts.checklist })
    .from(shifts)
    .where(eq(shifts.id, shiftId))
    .limit(1);
  return row?.checklist ?? [];
}
