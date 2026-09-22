import { and, asc, desc, eq, isNotNull, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { inventoryCounts, inventoryItems, shifts } from "@/db/schema";
import type { ChecklistKey, CountRow } from "@/lib/inventory-rules";

// Re-exported so server modules have one import for inventory concerns; the
// client imports the rules module directly, since this one reaches Postgres.
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
 * End-of-shift inventory.
 *
 * The student counts what is left, the app works out what was used and what
 * needs restocking. Counting is the teaching goal, so the app never guesses the
 * remaining figure from sales: a cup dropped on the floor is a real difference
 * between what was sold and what is gone, and noticing that difference is part
 * of the job.
 */

/**
 * Opens the count for a shift, creating a row per active item the first time
 * it is visited.
 *
 * The starting quantity is what the previous shift left after restocking, and
 * the par level when there is no previous shift to ask. It is written into the
 * row rather than looked up later, because it is a claim about what was on the
 * cart at that moment and must not change when the par level does.
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
  // A restocked item went back up to par; otherwise the cart still holds
  // whatever the last shift left on it.
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

/** Adds or removes one completed checklist key, without disturbing the others. */
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
