import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db, getClient } from "@/db";
import {
  getDashboardStats,
  getSalesBetween,
  listOrdersBetween,
  listTeachersWithTotals,
} from "@/lib/admin-queries";
import { hashPin } from "@/lib/auth";
import { parseTeacherCardPreference } from "@/lib/validate";

/**
 * The admin side of staff card payments (3.7): marking a teacher who usually
 * pays by card, and reporting cash and card sales apart so the cash drawer can
 * be checked against the cash total alone.
 */

const TEACHER = "0b6f3c2e-8a51-4c1e-9d7a-2f4b6c8d0e1a";

describe("parseTeacherCardPreference", () => {
  it("accepts a teacher id and a boolean", () => {
    expect(parseTeacherCardPreference({ teacherId: TEACHER, prefersCard: true })).toEqual({
      teacherId: TEACHER,
      prefersCard: true,
    });
    expect(parseTeacherCardPreference({ teacherId: TEACHER, prefersCard: false })).toEqual({
      teacherId: TEACHER,
      prefersCard: false,
    });
  });

  it("refuses anything that is not a uuid and a boolean", () => {
    expect(parseTeacherCardPreference(null)).toBeNull();
    expect(parseTeacherCardPreference({ teacherId: "1", prefersCard: true })).toBeNull();
    expect(parseTeacherCardPreference({ teacherId: TEACHER, prefersCard: "true" })).toBeNull();
    expect(parseTeacherCardPreference({ teacherId: TEACHER })).toBeNull();
  });
});

let studentId: string;
let teacherId: string;
let shiftId: string;

beforeAll(async () => {
  const [student] = await db.execute<{ id: string }>(
    sql`INSERT INTO students (display_name, pin_hash)
        VALUES (${`Card Test ${Date.now()}`}, ${await hashPin("1234")}) RETURNING id`,
  );
  studentId = student.id;
  const [teacher] = await db.execute<{ id: string }>(
    sql`INSERT INTO persons (name) VALUES (${`Card Teacher ${Date.now()}`}) RETURNING id`,
  );
  teacherId = teacher.id;
  await db.execute(sql`INSERT INTO teacher_profiles (person_id, prefers_card) VALUES (${teacherId}, true)`);
  const [shift] = await db.execute<{ id: string }>(
    sql`INSERT INTO shifts (student_id) VALUES (${studentId}) RETURNING id`,
  );
  shiftId = shift.id;
});

afterAll(async () => {
  await db.execute(sql`DELETE FROM orders WHERE teacher_id = ${teacherId}`);
  await db.execute(sql`DELETE FROM shifts WHERE student_id = ${studentId}`);
  await db.execute(sql`DELETE FROM students WHERE id = ${studentId}`);
  await db.execute(sql`DELETE FROM teacher_profiles WHERE person_id = ${teacherId}`);
  await db.execute(sql`DELETE FROM persons WHERE id = ${teacherId}`);
  await getClient().end();
});

/** A cash order of 350 paid with 500, and a card order of 425, both now. */
async function insertOneOfEach(): Promise<void> {
  await db.execute(sql`
    INSERT INTO orders (shift_id, teacher_id, total_cents, payment_method, received_cents, change_cents, created_at)
    VALUES
      (${shiftId}, ${teacherId}, 350, 'cash', 500, 150, now()),
      (${shiftId}, ${teacherId}, 425, 'card', NULL, NULL, now())
  `);
}

describe("sales split by how teachers paid", () => {
  it("splits the dashboard's sales into cash and card", async () => {
    const boundary = new Date(Date.now() - 60_000);
    const before = await getDashboardStats(boundary);
    await insertOneOfEach();
    const after = await getDashboardStats(boundary);

    expect(after.ordersToday - before.ordersToday).toBe(2);
    expect(after.salesTodayCents - before.salesTodayCents).toBe(775);
    expect(after.cashSalesTodayCents - before.cashSalesTodayCents).toBe(350);
    expect(after.cardSalesTodayCents - before.cardSalesTodayCents).toBe(425);
  });

  it("totals a day of orders by method", async () => {
    const from = new Date(Date.now() - 60 * 60_000);
    const to = new Date(Date.now() + 60 * 60_000);
    const sales = await getSalesBetween(from, to);
    expect(sales.totalCents).toBe(sales.cashCents + sales.cardCents);
    expect(sales.cashCents).toBeGreaterThanOrEqual(350);
    expect(sales.cardCents).toBeGreaterThanOrEqual(425);

    const empty = await getSalesBetween(new Date("2001-01-01"), new Date("2001-01-02"));
    expect(empty).toEqual({ orderCount: 0, totalCents: 0, cashCents: 0, cardCents: 0 });
  });

  it("lists each order with how it was paid", async () => {
    const from = new Date(Date.now() - 60 * 60_000);
    const to = new Date(Date.now() + 60 * 60_000);
    const mine = (await listOrdersBetween(from, to)).filter((row) => row.teacherId === teacherId);

    const cash = mine.find((row) => row.paymentMethod === "cash");
    const card = mine.find((row) => row.paymentMethod === "card");
    expect(cash).toMatchObject({ totalCents: 350, receivedCents: 500, changeCents: 150 });
    expect(card).toMatchObject({ totalCents: 425, receivedCents: null, changeCents: null });
  });
});

describe("teacher card preference", () => {
  it("is on the teacher list", async () => {
    const rows = await listTeachersWithTotals();
    expect(rows.find((row) => row.id === teacherId)?.prefersCard).toBe(true);
  });
});
