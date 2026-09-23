import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db, getClient } from "@/db";
import { getDashboardStats } from "@/lib/admin-queries";
import { hashPin } from "@/lib/auth";

/**
 * The admin dashboard's query, against a real database.
 *
 * This query shipped untested and threw on every visit: it passed a Date into a
 * raw sql template, which Drizzle's postgres.js adapter cannot serialize. The
 * first test would have failed on that before it was ever deployed.
 */

let studentId: string;
let teacherId: string;

beforeAll(async () => {
  const [student] = await db.execute<{ id: string }>(
    sql`INSERT INTO students (display_name, pin_hash)
        VALUES (${`Dashboard Test ${Date.now()}`}, ${await hashPin("1234")}) RETURNING id`,
  );
  studentId = student.id;
  const [teacher] = await db.execute<{ id: string }>(
    sql`INSERT INTO persons (name) VALUES ('Dashboard Teacher') RETURNING id`,
  );
  teacherId = teacher.id;
  await db.execute(sql`INSERT INTO teacher_profiles (person_id) VALUES (${teacherId})`);
});

afterAll(async () => {
  await db.execute(sql`DELETE FROM orders WHERE teacher_id = ${teacherId}`);
  await db.execute(sql`DELETE FROM shifts WHERE student_id = ${studentId}`);
  await db.execute(sql`DELETE FROM students WHERE id = ${studentId}`);
  await db.execute(sql`DELETE FROM teacher_profiles WHERE person_id = ${teacherId}`);
  await db.execute(sql`DELETE FROM persons WHERE id = ${teacherId}`);
  await getClient().end();
});

describe("getDashboardStats", () => {
  it("runs at all, given a Date", async () => {
    await expect(getDashboardStats(new Date())).resolves.toBeDefined();
  });

  it("counts only orders placed since the boundary", async () => {
    const boundary = new Date(Date.now() - 60_000);
    const before = await getDashboardStats(boundary);

    const [shift] = await db.execute<{ id: string }>(
      sql`INSERT INTO shifts (student_id) VALUES (${studentId}) RETURNING id`,
    );
    // One order after the boundary, one well before it.
    await db.execute(sql`
      INSERT INTO orders (shift_id, teacher_id, total_cents, payment_method, received_cents, change_cents, created_at)
      VALUES
        (${shift.id}, ${teacherId}, 350, 'cash', 500, 150, now()),
        (${shift.id}, ${teacherId}, 999, 'cash', 1000, 1, now() - interval '2 days')
    `);

    const after = await getDashboardStats(boundary);
    expect(after.ordersToday - before.ordersToday).toBe(1);
    expect(after.salesTodayCents - before.salesTodayCents).toBe(350);
    expect(after.openShifts - before.openShifts).toBe(1);
  });
});
