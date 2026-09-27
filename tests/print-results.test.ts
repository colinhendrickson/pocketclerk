import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db, getClient } from "@/db";
import { hashPin } from "@/lib/auth";
import { recordPrintResult } from "@/lib/receipt-jobs";

/**
 * The tablet reports what its printer did. A report may only settle a print job
 * that this shift claimed, so one device cannot mark another shift's receipts
 * as printed and quietly drop them.
 */

const students: string[] = [];
const shifts: string[] = [];
const orders: string[] = [];
let teacherId: string;

async function newShift(): Promise<string> {
  const [student] = await db.execute<{ id: string }>(
    sql`INSERT INTO students (display_name, pin_hash)
        VALUES (${`Print Test ${Date.now()}-${students.length}`}, ${await hashPin("1234")}) RETURNING id`,
  );
  students.push(student.id);
  const [shift] = await db.execute<{ id: string }>(
    sql`INSERT INTO shifts (student_id) VALUES (${student.id}) RETURNING id`,
  );
  shifts.push(shift.id);
  return shift.id;
}

/** A job on a fresh order: each order has at most one job per channel. */
async function job(shiftId: string, channel: "print" | "email", status: string): Promise<string> {
  const [order] = await db.execute<{ id: string }>(
    sql`INSERT INTO orders (shift_id, teacher_id, total_cents, payment_method, received_cents, change_cents)
        VALUES (${shiftId}, ${teacherId}, 100, 'cash', 100, 0) RETURNING id`,
  );
  orders.push(order.id);
  const [row] = await db.execute<{ id: string }>(
    sql`INSERT INTO receipt_jobs (order_id, channel, status, attempts)
        VALUES (${order.id}, ${channel}, ${status}::receipt_status, 1) RETURNING id`,
  );
  return row.id;
}

async function statusOf(jobId: string): Promise<{ status: string; last_error: string | null }> {
  const [row] = await db.execute<{ status: string; last_error: string | null }>(
    sql`SELECT status, last_error FROM receipt_jobs WHERE id = ${jobId}`,
  );
  return row;
}

let mine: string;
let theirs: string;

beforeAll(async () => {
  const [teacher] = await db.execute<{ id: string }>(
    sql`INSERT INTO persons (name, email) VALUES ('Print Teacher', 'print-teacher@example.invalid') RETURNING id`,
  );
  teacherId = teacher.id;
  await db.execute(sql`INSERT INTO teacher_profiles (person_id) VALUES (${teacherId})`);
  mine = await newShift();
  theirs = await newShift();
});

afterAll(async () => {
  for (const id of orders) await db.execute(sql`DELETE FROM orders WHERE id = ${id}`);
  for (const id of shifts) await db.execute(sql`DELETE FROM shifts WHERE id = ${id}`);
  for (const id of students) await db.execute(sql`DELETE FROM students WHERE id = ${id}`);
  await db.execute(sql`DELETE FROM teacher_profiles WHERE person_id = ${teacherId}`);
  await db.execute(sql`DELETE FROM persons WHERE id = ${teacherId}`);
  await getClient().end();
});

describe("recordPrintResult", () => {
  it("settles a print job this shift claimed", async () => {
    const jobId = await job(mine, "print", "processing");
    expect(await recordPrintResult(jobId, mine, { ok: true })).toBe(true);
    expect((await statusOf(jobId)).status).toBe("sent");
  });

  it("returns a failed print to the queue with its error", async () => {
    const jobId = await job(mine, "print", "processing");
    expect(await recordPrintResult(jobId, mine, { ok: false, error: "Out of paper" })).toBe(true);
    expect(await statusOf(jobId)).toEqual({ status: "queued", last_error: "Out of paper" });
  });

  it("refuses another shift's job", async () => {
    const jobId = await job(theirs, "print", "processing");
    expect(await recordPrintResult(jobId, mine, { ok: true })).toBe(false);
    expect((await statusOf(jobId)).status).toBe("processing");
  });

  it("refuses a job that was never claimed, and an email job", async () => {
    const queued = await job(mine, "print", "queued");
    expect(await recordPrintResult(queued, mine, { ok: true })).toBe(false);
    expect((await statusOf(queued)).status).toBe("queued");

    const email = await job(mine, "email", "processing");
    expect(await recordPrintResult(email, mine, { ok: true })).toBe(false);
    expect((await statusOf(email)).status).toBe("processing");
  });
});
