import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db, getClient } from "@/db";
import { hashPin } from "@/lib/auth";
import { placeOrder } from "@/lib/orders";

/**
 * Placing an order. The cart retries when a response is lost, so the same
 * order id must never be counted twice, and anything the menu no longer sells
 * must be refused as a result, not thrown.
 */

let studentId: string;
let otherStudentId: string;
let shiftId: string;
let otherShiftId: string;
let teacherId: string;
let itemId: string;
let retiredItemId: string;
let addonId: string;
let retiredAddonId: string;

beforeAll(async () => {
  const stamp = Date.now();
  const pinHash = await hashPin("1234");
  const [student] = await db.execute<{ id: string }>(
    sql`INSERT INTO students (display_name, pin_hash) VALUES (${`Order Test ${stamp}`}, ${pinHash}) RETURNING id`,
  );
  studentId = student.id;
  const [other] = await db.execute<{ id: string }>(
    sql`INSERT INTO students (display_name, pin_hash) VALUES (${`Order Other ${stamp}`}, ${pinHash}) RETURNING id`,
  );
  otherStudentId = other.id;

  const [shift] = await db.execute<{ id: string }>(
    sql`INSERT INTO shifts (student_id) VALUES (${studentId}) RETURNING id`,
  );
  shiftId = shift.id;
  const [otherShift] = await db.execute<{ id: string }>(
    sql`INSERT INTO shifts (student_id) VALUES (${otherStudentId}) RETURNING id`,
  );
  otherShiftId = otherShift.id;

  const [person] = await db.execute<{ id: string }>(
    sql`INSERT INTO persons (name, email) VALUES ('Order Teacher', 'order-teacher@example.edu') RETURNING id`,
  );
  teacherId = person.id;
  await db.execute(sql`INSERT INTO teacher_profiles (person_id) VALUES (${teacherId})`);

  const [item] = await db.execute<{ id: string }>(
    sql`INSERT INTO menu_items (name, price_cents) VALUES (${`Order test drink ${stamp}`}, 250) RETURNING id`,
  );
  itemId = item.id;
  const [retired] = await db.execute<{ id: string }>(
    sql`INSERT INTO menu_items (name, price_cents, active) VALUES (${`Order test retired ${stamp}`}, 250, false) RETURNING id`,
  );
  retiredItemId = retired.id;
  const [addon] = await db.execute<{ id: string }>(
    sql`INSERT INTO addons (name, price_cents) VALUES (${`Order test addon ${stamp}`}, 50) RETURNING id`,
  );
  addonId = addon.id;
  const [retiredAddon] = await db.execute<{ id: string }>(
    sql`INSERT INTO addons (name, price_cents, active) VALUES (${`Order test old addon ${stamp}`}, 50, false) RETURNING id`,
  );
  retiredAddonId = retiredAddon.id;
});

afterAll(async () => {
  await db.execute(
    sql`DELETE FROM receipt_jobs WHERE order_id IN (SELECT id FROM orders WHERE teacher_id = ${teacherId})`,
  );
  await db.execute(sql`DELETE FROM orders WHERE teacher_id = ${teacherId}`);
  await db.execute(sql`DELETE FROM shifts WHERE student_id IN (${studentId}, ${otherStudentId})`);
  await db.execute(sql`DELETE FROM students WHERE id IN (${studentId}, ${otherStudentId})`);
  await db.execute(sql`DELETE FROM teacher_profiles WHERE person_id = ${teacherId}`);
  await db.execute(sql`DELETE FROM persons WHERE id = ${teacherId}`);
  await db.execute(sql`DELETE FROM menu_items WHERE id IN (${itemId}, ${retiredItemId})`);
  await db.execute(sql`DELETE FROM addons WHERE id IN (${addonId}, ${retiredAddonId})`);
  await getClient().end();
});

function order(overrides: Partial<Parameters<typeof placeOrder>[1]> = {}) {
  return {
    orderId: randomUUID(),
    teacherId,
    receivedCents: 1000,
    lines: [{ menuItemId: itemId, qty: 2, addonIds: [addonId] }],
    ...overrides,
  };
}

async function count(table: "orders" | "receipt_jobs", orderId: string): Promise<number> {
  const [row] =
    table === "orders"
      ? await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM orders WHERE id = ${orderId}`)
      : await db.execute<{ n: number }>(
          sql`SELECT count(*)::int AS n FROM receipt_jobs WHERE order_id = ${orderId}`,
        );
  return row.n;
}

describe("placeOrder", () => {
  it("prices the order from the database and records it under the given id", async () => {
    const input = order();
    const result = await placeOrder(shiftId, input);
    expect(result).toEqual({
      ok: true,
      orderId: input.orderId,
      totalCents: 600,
      changeCents: 400,
      created: true,
    });
    expect(await count("orders", input.orderId)).toBe(1);
    // A print job, plus an email job because the teacher has an address.
    expect(await count("receipt_jobs", input.orderId)).toBe(2);
  });

  it("returns the first result for a retried order instead of counting it twice", async () => {
    const input = order();
    const first = await placeOrder(shiftId, input);
    const again = await placeOrder(shiftId, input);

    expect(again).toEqual({ ...first, created: false });
    expect(await count("orders", input.orderId)).toBe(1);
    expect(await count("receipt_jobs", input.orderId)).toBe(2);
  });

  it("records one order when the same id arrives twice at once", async () => {
    const input = order();
    const results = await Promise.all([placeOrder(shiftId, input), placeOrder(shiftId, input)]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(results.filter((r) => r.ok && r.created)).toHaveLength(1);
    expect(await count("orders", input.orderId)).toBe(1);
    expect(await count("receipt_jobs", input.orderId)).toBe(2);
  });

  it("refuses an order id already used by another shift", async () => {
    const input = order();
    await placeOrder(otherShiftId, input);
    expect(await placeOrder(shiftId, input)).toEqual({ ok: false, error: "invalid" });
  });

  it("returns unknown_item for an item that does not exist, rather than throwing", async () => {
    const result = await placeOrder(
      shiftId,
      order({ lines: [{ menuItemId: randomUUID(), qty: 1, addonIds: [] }] }),
    );
    expect(result).toEqual({ ok: false, error: "unknown_item" });
  });

  it("refuses an item or add-on taken off the menu", async () => {
    expect(
      await placeOrder(shiftId, order({ lines: [{ menuItemId: retiredItemId, qty: 1, addonIds: [] }] })),
    ).toEqual({ ok: false, error: "unknown_item" });
    expect(
      await placeOrder(
        shiftId,
        order({ lines: [{ menuItemId: itemId, qty: 1, addonIds: [retiredAddonId] }] }),
      ),
    ).toEqual({ ok: false, error: "unknown_item" });
  });

  it("refuses too little money without recording anything", async () => {
    const input = order({ receivedCents: 100 });
    expect(await placeOrder(shiftId, input)).toEqual({ ok: false, error: "insufficient" });
    expect(await count("orders", input.orderId)).toBe(0);
  });
});
