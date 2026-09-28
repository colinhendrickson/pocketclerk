import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db, getClient } from "@/db";
import { hashPin } from "@/lib/auth";
import {
  claimCartPrintJobs,
  claimJobs,
  MAX_ATTEMPTS,
  recordPrintResult,
} from "@/lib/receipt-jobs";

/**
 * The cart iPad claims print jobs and reports what its printer did. There is
 * one iPad per cart, so it prints any recent queued receipt, including ones
 * from a shift that has since closed, and may settle only claimed print jobs.
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

interface JobOptions {
  attempts?: number;
  /** Order age, as a Postgres interval. */
  orderAge?: string;
  /** How long ago the job last changed, as a Postgres interval. */
  idleFor?: string;
}

/** A job on a fresh order: each order has at most one job per channel. */
async function job(
  shiftId: string,
  channel: "print" | "email",
  status: string,
  { attempts = 1, orderAge = "0 seconds", idleFor = "0 seconds" }: JobOptions = {},
): Promise<string> {
  const [order] = await db.execute<{ id: string }>(
    sql`INSERT INTO orders (shift_id, teacher_id, total_cents, payment_method, received_cents, change_cents, created_at)
        VALUES (${shiftId}, ${teacherId}, 100, 'cash', 100, 0, now() - ${orderAge}::interval) RETURNING id`,
  );
  orders.push(order.id);
  const [row] = await db.execute<{ id: string }>(
    sql`INSERT INTO receipt_jobs (order_id, channel, status, attempts, created_at, updated_at)
        VALUES (${order.id}, ${channel}, ${status}::receipt_status, ${attempts},
                now() - ${orderAge}::interval, now() - ${idleFor}::interval)
        RETURNING id`,
  );
  return row.id;
}

async function statusOf(jobId: string): Promise<{ status: string; last_error: string | null }> {
  const [row] = await db.execute<{ status: string; last_error: string | null }>(
    sql`SELECT status, last_error FROM receipt_jobs WHERE id = ${jobId}`,
  );
  return row;
}

/** Claims print jobs until the queue is empty; other suites may leave jobs behind. */
async function claimAllPrint(): Promise<string[]> {
  const ids: string[] = [];
  for (;;) {
    const batch = await claimCartPrintJobs(50);
    if (batch.length === 0) return ids;
    ids.push(...batch.map((j) => j.id));
  }
}

let open: string;
let closed: string;

beforeAll(async () => {
  const [teacher] = await db.execute<{ id: string }>(
    sql`INSERT INTO persons (name, email) VALUES ('Print Teacher', 'print-teacher@example.invalid') RETURNING id`,
  );
  teacherId = teacher.id;
  await db.execute(sql`INSERT INTO teacher_profiles (person_id) VALUES (${teacherId})`);
  open = await newShift();
  closed = await newShift();
  await db.execute(
    sql`UPDATE shifts SET clock_out = now(), hours_hundredths = 0, reward_tickets = 0
        WHERE id = ${closed}`,
  );
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
  it("settles a claimed print job", async () => {
    const jobId = await job(open, "print", "processing");
    expect(await recordPrintResult(jobId, { ok: true })).toBe(true);
    expect((await statusOf(jobId)).status).toBe("sent");
  });

  it("returns a failed print to the queue with its error", async () => {
    const jobId = await job(open, "print", "processing");
    expect(await recordPrintResult(jobId, { ok: false, error: "Out of paper" })).toBe(true);
    expect(await statusOf(jobId)).toEqual({ status: "queued", last_error: "Out of paper" });
  });

  it("claims and settles a job left over from an earlier, closed shift", async () => {
    const jobId = await job(closed, "print", "queued");
    expect(await claimAllPrint()).toContain(jobId);
    expect(await recordPrintResult(jobId, { ok: true })).toBe(true);
    expect((await statusOf(jobId)).status).toBe("sent");
  });

  it("refuses a job that was never claimed, and an email job", async () => {
    const queued = await job(open, "print", "queued");
    expect(await recordPrintResult(queued, { ok: true })).toBe(false);
    expect((await statusOf(queued)).status).toBe("queued");

    const email = await job(open, "email", "processing");
    expect(await recordPrintResult(email, { ok: true })).toBe(false);
    expect((await statusOf(email)).status).toBe("processing");
  });

  it("refuses a job that was already sent", async () => {
    const sent = await job(open, "print", "sent");
    expect(await recordPrintResult(sent, { ok: false, error: "late" })).toBe(false);
    expect((await statusOf(sent)).status).toBe("sent");
  });
});

describe("claimCartPrintJobs", () => {
  it("skips receipts for orders older than the print window", async () => {
    const old = await job(open, "print", "queued", { orderAge: "8 days" });
    expect(await claimAllPrint()).not.toContain(old);
    expect((await statusOf(old)).status).toBe("queued");
  });

  it("returns the oldest receipts first", async () => {
    await claimAllPrint();
    const newer = await job(open, "print", "queued", { orderAge: "1 minute" });
    const older = await job(open, "print", "queued", { orderAge: "2 days" });
    const ids = (await claimCartPrintJobs(50)).map((j) => j.id);
    expect(ids.indexOf(older)).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf(older)).toBeLessThan(ids.indexOf(newer));
  });

  it("marks a stale job on its final attempt failed instead of stranding it", async () => {
    const stranded = await job(open, "print", "processing", {
      attempts: MAX_ATTEMPTS,
      idleFor: "11 minutes",
    });
    expect(await claimAllPrint()).not.toContain(stranded);
    const { status, last_error } = await statusOf(stranded);
    expect(status).toBe("failed");
    expect(last_error).toMatch(/never reported/i);
  });

  it("skips a job another claimer holds instead of claiming it twice", async () => {
    await claimAllPrint();
    const held = await job(open, "print", "queued");
    let second: Promise<{ id: string }[]> = Promise.resolve([]);
    await getClient().begin(async (tx) => {
      // A first claimer has taken the row but not yet committed.
      await tx`UPDATE receipt_jobs SET status = 'processing', attempts = attempts + 1,
               updated_at = now() WHERE id = ${held}`;
      second = claimCartPrintJobs(50);
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    expect((await second).map((j) => j.id)).not.toContain(held);
  });

  it("never hands the same job to two parallel claimers", async () => {
    await claimAllPrint();
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) ids.push(await job(open, "print", "queued"));
    const [a, b] = await Promise.all([claimCartPrintJobs(10), claimCartPrintJobs(10)]);
    const aIds = new Set(a.map((j) => j.id));
    expect(b.filter((j) => aIds.has(j.id))).toEqual([]);
    const claimed = new Set([...aIds, ...b.map((j) => j.id)]);
    for (const id of ids) expect(claimed.has(id)).toBe(true);
  });
});

describe("claimJobs (email)", () => {
  it("marks a stale email job on its final attempt failed", async () => {
    const stranded = await job(open, "email", "processing", {
      attempts: MAX_ATTEMPTS,
      idleFor: "11 minutes",
    });
    const claimed = await claimJobs("email", 50);
    expect(claimed.map((j) => j.id)).not.toContain(stranded);
    // Return anything this suite did not create to the queue untouched.
    for (const j of claimed) {
      await db.execute(
        sql`UPDATE receipt_jobs SET status = 'queued', attempts = attempts - 1 WHERE id = ${j.id}`,
      );
    }
    const { status, last_error } = await statusOf(stranded);
    expect(status).toBe("failed");
    expect(last_error).toMatch(/never reported/i);
  });
});
