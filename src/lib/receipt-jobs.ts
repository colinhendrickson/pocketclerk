import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  orderItemAddons,
  orderItems,
  orders,
  persons,
  receiptJobs,
  shifts,
  students,
  teacherProfiles,
} from "@/db/schema";
import { branding } from "@/lib/branding";
import type { Receipt, ReceiptLine } from "@/providers/renderer/receipt";

/**
 * Claiming and completing receipt jobs.
 *
 * A job is claimed with a single `UPDATE ... RETURNING` guarded on its current
 * status. That is what makes concurrent consumers safe: two overlapping runs
 * both issue the update, Postgres serializes them, and only one sees a row
 * returned. The scaled-up form of this is `FOR UPDATE SKIP LOCKED`; at this
 * volume the guarded update is the same guarantee with less machinery.
 */

/** How many times a job is retried before it is left for a human. */
export const MAX_ATTEMPTS = 5;

/** Drizzle's `execute` generic requires an index signature on the row type. */
export interface ClaimedJob extends Record<string, unknown> {
  id: string;
  orderId: string;
  attempts: number;
}

/**
 * How long a job may sit in `processing` before it is presumed abandoned.
 *
 * A consumer can die holding a job: a serverless function hits its time limit,
 * the instance is recycled, or, as happened here, an error escapes the loop.
 * Before this, a job left in `processing` was never claimed again, never sent
 * and never marked failed, so it appeared nowhere, not even on the admin
 * receipts page. Ten minutes is far longer than any real delivery takes, so a
 * live consumer is never robbed of a job it is still working on. Re-sending is
 * safe because the job id is the provider's idempotency key.
 */
const STALE_PROCESSING = sql`interval '10 minutes'`;

/**
 * Atomically moves up to `limit` claimable jobs on this channel to
 * `processing` and returns them. Claimable means queued, or stuck in
 * processing long enough that its consumer is gone. A job another live
 * consumer holds is not returned, because neither predicate matches it.
 */
export async function claimJobs(
  channel: "print" | "email",
  limit = 5,
): Promise<ClaimedJob[]> {
  const rows = await db.execute<ClaimedJob>(sql`
    UPDATE receipt_jobs
    SET status = 'processing', attempts = attempts + 1, updated_at = now()
    WHERE id IN (
      SELECT id FROM receipt_jobs
      WHERE channel = ${channel}
        AND (status = 'queued'
             OR (status = 'processing' AND updated_at < now() - ${STALE_PROCESSING}))
        AND attempts < ${MAX_ATTEMPTS}
      ORDER BY created_at
      LIMIT ${limit}
    )
    RETURNING id, order_id AS "orderId", attempts
  `);
  return [...rows];
}

/** Same claim, restricted to one shift: the tablet may only print its own sales. */
export async function claimJobsForShift(
  shiftId: string,
  channel: "print" | "email",
  limit = 5,
): Promise<ClaimedJob[]> {
  const rows = await db.execute<ClaimedJob>(sql`
    UPDATE receipt_jobs
    SET status = 'processing', attempts = attempts + 1, updated_at = now()
    WHERE id IN (
      SELECT j.id FROM receipt_jobs j
      JOIN orders o ON o.id = j.order_id
      WHERE j.channel = ${channel}
        AND (j.status = 'queued'
             OR (j.status = 'processing' AND j.updated_at < now() - ${STALE_PROCESSING}))
        AND j.attempts < ${MAX_ATTEMPTS}
        AND o.shift_id = ${shiftId}
      ORDER BY j.created_at
      LIMIT ${limit}
    )
    RETURNING id, order_id AS "orderId", attempts
  `);
  return [...rows];
}

export async function markSent(jobId: string): Promise<void> {
  await db
    .update(receiptJobs)
    .set({ status: "sent", lastError: null, updatedAt: new Date() })
    .where(eq(receiptJobs.id, jobId));
}

/**
 * Returns a job to the queue, or gives up once it has used its attempts.
 *
 * A job that has exhausted its retries stays `failed` with its last error
 * intact, which is what the admin monitor reads. Silent loss is the one outcome
 * this design refuses.
 */
export async function markFailed(jobId: string, error: string): Promise<void> {
  // The casts are required. A CASE of string literals is typed text, and
  // Postgres will not assign text to an enum column, so without them this
  // statement failed every single time it ran. Every undeliverable receipt then
  // crashed the code meant to record it, which abandoned the rest of its batch
  // in `processing`, where nothing reclaimed it. See STALE_PROCESSING above.
  await db.execute(sql`
    UPDATE receipt_jobs
    SET status = CASE
          WHEN attempts >= ${MAX_ATTEMPTS} THEN 'failed'::receipt_status
          ELSE 'queued'::receipt_status
        END,
        last_error = ${error.slice(0, 500)},
        updated_at = now()
    WHERE id = ${jobId}
  `);
}

/** Rebuilds the receipt for an order from its snapshotted rows. */
export async function buildReceipt(orderId: string): Promise<Receipt | null> {
  const [order] = await db
    .select({
      id: orders.id,
      totalCents: orders.totalCents,
      receivedCents: orders.receivedCents,
      changeCents: orders.changeCents,
      createdAt: orders.createdAt,
      teacherName: persons.name,
      teacherEmail: persons.email,
      room: teacherProfiles.room,
      studentName: students.displayName,
    })
    .from(orders)
    .innerJoin(teacherProfiles, eq(teacherProfiles.personId, orders.teacherId))
    .innerJoin(persons, eq(persons.id, teacherProfiles.personId))
    .innerJoin(shifts, eq(shifts.id, orders.shiftId))
    .innerJoin(students, eq(students.id, shifts.studentId))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return null;

  const items = await db
    .select({
      id: orderItems.id,
      name: orderItems.nameSnapshot,
      qty: orderItems.qty,
      unitPriceCents: orderItems.unitPriceCents,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(asc(orderItems.id));

  const extras = await db
    .select({
      orderItemId: orderItemAddons.orderItemId,
      name: orderItemAddons.nameSnapshot,
      priceCents: orderItemAddons.priceCents,
    })
    .from(orderItemAddons)
    .where(
      and(
        sql`${orderItemAddons.orderItemId} IN (
          SELECT id FROM order_items WHERE order_id = ${orderId})`,
      ),
    );

  // Names and prices come from the snapshot columns, not from the live menu, so
  // a receipt reprinted next term still says what was actually charged.
  const lines: ReceiptLine[] = [];
  for (const item of items) {
    lines.push({
      name: item.name,
      qty: item.qty,
      amountCents: item.unitPriceCents * item.qty,
    });
    for (const extra of extras.filter((e) => e.orderItemId === item.id)) {
      lines.push({
        name: extra.name,
        qty: item.qty,
        amountCents: extra.priceCents * item.qty,
        isAddon: true,
      });
    }
  }

  return {
    programName: branding.programName,
    cartName: branding.cartName,
    teacherName: order.teacherName,
    room: order.room,
    studentName: order.studentName,
    placedAt: order.createdAt,
    lines,
    totalCents: order.totalCents,
    receivedCents: order.receivedCents ?? order.totalCents,
    changeCents: order.changeCents ?? 0,
  };
}

/** The recipient for an order's email receipt, or null if none is saved. */
export async function receiptEmailFor(orderId: string): Promise<string | null> {
  const [row] = await db
    .select({ email: persons.email })
    .from(orders)
    .innerJoin(persons, eq(persons.id, orders.teacherId))
    .where(eq(orders.id, orderId))
    .limit(1);
  return row?.email ?? null;
}
