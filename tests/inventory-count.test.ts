import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db, getClient } from "@/db";
import { hashPin } from "@/lib/auth";
import { listCount, openCount, recordRemaining, usedCount } from "@/lib/inventory";

/**
 * End-of-shift counts against a real Postgres: opening a count, recording a
 * count above the start (stock added between shifts), and carrying it forward.
 */

let studentId: string;
let itemId: string;
const PAR = 50;

async function openShift(): Promise<string> {
  const [shift] = await db.execute<{ id: string }>(
    sql`INSERT INTO shifts (student_id) VALUES (${studentId}) RETURNING id`,
  );
  return shift.id;
}

async function closeShift(shiftId: string): Promise<void> {
  await db.execute(
    sql`UPDATE shifts SET clock_out = now(), hours_hundredths = 0, reward_tickets = 0
        WHERE id = ${shiftId}`,
  );
}

async function rowFor(shiftId: string) {
  const row = (await listCount(shiftId)).find((r) => r.itemId === itemId);
  if (!row) throw new Error("Expected a count row for the test item.");
  return row;
}

beforeAll(async () => {
  const pinHash = await hashPin("1234");
  const [student] = await db.execute<{ id: string }>(
    sql`INSERT INTO students (display_name, pin_hash)
        VALUES ('Inventory Count Test', ${pinHash}) RETURNING id`,
  );
  studentId = student.id;

  const [item] = await db.execute<{ id: string }>(
    sql`INSERT INTO inventory_items (name, unit, par_level)
        VALUES (${`Count test cups ${Date.now()}`}, 'cups', ${PAR}) RETURNING id`,
  );
  itemId = item.id;
});

afterAll(async () => {
  // Counts cascade with their shifts; the item goes last since counts restrict it.
  await db.execute(sql`DELETE FROM shifts WHERE student_id = ${studentId}`);
  await db.execute(sql`DELETE FROM students WHERE id = ${studentId}`);
  await db.execute(sql`DELETE FROM inventory_items WHERE id = ${itemId}`);
  await getClient().end();
});

describe("openCount", () => {
  it("survives two first visits at once without a duplicate-row error", async () => {
    const shiftId = await openShift();
    try {
      const [a, b] = await Promise.all([openCount(shiftId), openCount(shiftId)]);
      expect(a.map((r) => r.itemId)).toEqual(b.map((r) => r.itemId));
      expect(a.filter((r) => r.itemId === itemId)).toHaveLength(1);
    } finally {
      await closeShift(shiftId);
    }
  });
});

describe("counting above the start", () => {
  it("stores the higher count, reports zero used, and carries it to the next shift", async () => {
    const first = await openShift();
    await openCount(first);
    const opened = await rowFor(first);

    // A teacher refilled cups since the last count.
    const higher = opened.starting + 10;
    await recordRemaining(first, itemId, higher);
    const counted = await rowFor(first);
    expect(counted.remaining).toBe(higher);
    expect(usedCount(counted)).toBe(0);
    await closeShift(first);

    const second = await openShift();
    await openCount(second);
    expect((await rowFor(second)).starting).toBe(higher);
    await closeShift(second);
  });
});
