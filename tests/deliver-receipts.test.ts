import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db, getClient } from "@/db";
import { hashPin } from "@/lib/auth";
import { deliverQueuedEmails } from "@/lib/deliver-receipts";
import type { EmailSender, SendResult } from "@/providers/email";
import type { Receipt } from "@/providers/renderer/receipt";

/**
 * Receipt delivery, against a real queue.
 *
 * The idempotency key was documented on the Resend sender and never passed by
 * the only caller, so a retried job could email a teacher the same receipt
 * twice. This pins down that the key arrives, and that it is the job's id: the
 * one value that stays the same across every retry of the same receipt.
 */

class RecordingSender implements EmailSender {
  readonly name = "recording";
  calls: { to: string; receipt: Receipt; key?: string }[] = [];
  constructor(private readonly outcome: SendResult = { ok: true }) {}
  async send(to: string, receipt: Receipt, key?: string) {
    this.calls.push({ to, receipt, key });
    return this.outcome;
  }
  async sendText() {
    return { ok: true };
  }
}

let studentId: string;
let teacherId: string;
let orderId: string;
let jobId: string;

beforeAll(async () => {
  const [student] = await db.execute<{ id: string }>(
    sql`INSERT INTO students (display_name, pin_hash)
        VALUES (${`Receipt Test ${Date.now()}`}, ${await hashPin("1234")}) RETURNING id`,
  );
  studentId = student.id;

  const [teacher] = await db.execute<{ id: string }>(
    sql`INSERT INTO persons (name, email)
        VALUES ('Receipt Teacher', 'receipt-teacher@example.invalid') RETURNING id`,
  );
  teacherId = teacher.id;
  await db.execute(sql`INSERT INTO teacher_profiles (person_id) VALUES (${teacherId})`);

  const [shift] = await db.execute<{ id: string }>(
    sql`INSERT INTO shifts (student_id) VALUES (${studentId}) RETURNING id`,
  );
  const [order] = await db.execute<{ id: string }>(
    sql`INSERT INTO orders (shift_id, teacher_id, total_cents, payment_method, received_cents, change_cents)
        VALUES (${shift.id}, ${teacherId}, 300, 'cash', 500, 200) RETURNING id`,
  );
  orderId = order.id;
});

afterAll(async () => {
  await db.execute(sql`DELETE FROM orders WHERE id = ${orderId}`);
  await db.execute(sql`DELETE FROM shifts WHERE student_id = ${studentId}`);
  await db.execute(sql`DELETE FROM students WHERE id = ${studentId}`);
  await db.execute(sql`DELETE FROM teacher_profiles WHERE person_id = ${teacherId}`);
  await db.execute(sql`DELETE FROM persons WHERE id = ${teacherId}`);
  await getClient().end();
});

async function queueJob(): Promise<void> {
  await db.execute(sql`DELETE FROM receipt_jobs WHERE order_id = ${orderId}`);
  const [job] = await db.execute<{ id: string }>(
    sql`INSERT INTO receipt_jobs (order_id, channel) VALUES (${orderId}, 'email') RETURNING id`,
  );
  jobId = job.id;
}

async function jobStatus(): Promise<string> {
  const [row] = await db.execute<{ status: string }>(
    sql`SELECT status FROM receipt_jobs WHERE id = ${jobId}`,
  );
  return row.status;
}

describe("deliverQueuedEmails", () => {
  it("passes the job id as the idempotency key", async () => {
    await queueJob();
    const sender = new RecordingSender();

    await deliverQueuedEmails(50, sender);

    const mine = sender.calls.filter((c) => c.to === "receipt-teacher@example.invalid");
    expect(mine).toHaveLength(1);
    expect(mine[0].key).toBe(jobId);
    expect(await jobStatus()).toBe("sent");
  });

  it("records a refused send against the job instead of dropping it", async () => {
    await queueJob();
    const sender = new RecordingSender({ ok: false, error: "domain is not verified" });

    await deliverQueuedEmails(50, sender);

    const [row] = await db.execute<{ last_error: string | null }>(
      sql`SELECT last_error FROM receipt_jobs WHERE id = ${jobId}`,
    );
    expect(row.last_error).toBe("domain is not verified");
    expect(await jobStatus()).not.toBe("sent");
  });

  it("does not let one undeliverable receipt strand the rest of the batch", async () => {
    // A teacher with no email is the everyday case. markFailed used to crash on
    // it, and the crash abandoned every later job in the batch in processing.
    const [nomail] = await db.execute<{ id: string }>(
      sql`INSERT INTO persons (name) VALUES ('No Email Teacher') RETURNING id`,
    );
    await db.execute(sql`INSERT INTO teacher_profiles (person_id) VALUES (${nomail.id})`);
    const [shift] = await db.execute<{ id: string }>(
      sql`SELECT id FROM shifts WHERE student_id = ${studentId} LIMIT 1`,
    );
    const [badOrder] = await db.execute<{ id: string }>(
      sql`INSERT INTO orders (shift_id, teacher_id, total_cents, payment_method, received_cents, change_cents)
          VALUES (${shift.id}, ${nomail.id}, 200, 'cash', 200, 0) RETURNING id`,
    );

    try {
      // The bad job is queued first, so it is processed first.
      const [bad] = await db.execute<{ id: string }>(
        sql`INSERT INTO receipt_jobs (order_id, channel) VALUES (${badOrder.id}, 'email') RETURNING id`,
      );
      await queueJob();

      await deliverQueuedEmails(50, new RecordingSender());

      expect(await jobStatus()).toBe("sent");
      const [badRow] = await db.execute<{ status: string; last_error: string }>(
        sql`SELECT status, last_error FROM receipt_jobs WHERE id = ${bad.id}`,
      );
      expect(badRow.status).not.toBe("processing");
      expect(badRow.last_error).toBe("No email address saved for this teacher.");
    } finally {
      await db.execute(sql`DELETE FROM orders WHERE id = ${badOrder.id}`);
      await db.execute(sql`DELETE FROM teacher_profiles WHERE person_id = ${nomail.id}`);
      await db.execute(sql`DELETE FROM persons WHERE id = ${nomail.id}`);
    }
  });

  it("recovers a job its consumer abandoned in processing", async () => {
    await queueJob();
    await db.execute(
      sql`UPDATE receipt_jobs SET status = 'processing', updated_at = now() - interval '11 minutes'
          WHERE id = ${jobId}`,
    );

    await deliverQueuedEmails(50, new RecordingSender());
    expect(await jobStatus()).toBe("sent");
  });

  it("leaves alone a job a live consumer is still working on", async () => {
    await queueJob();
    await db.execute(
      sql`UPDATE receipt_jobs SET status = 'processing', updated_at = now() WHERE id = ${jobId}`,
    );

    const sender = new RecordingSender();
    await deliverQueuedEmails(50, sender);
    expect(sender.calls.some((c) => c.key === jobId)).toBe(false);
    expect(await jobStatus()).toBe("processing");
  });
});

