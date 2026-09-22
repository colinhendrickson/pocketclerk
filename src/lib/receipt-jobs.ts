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
 * both issue the update, Postgres serialises them, and only one sees a row
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
 * Atomically moves up to `limit` queued jobs on this channel to `processing`
 * and returns them. A job already being processed by another consumer is not
 * returned, because the `status = 'queued'` predicate no longer matches it.
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
        AND status = 'queued'
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
        AND j.status = 'queued'
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
  await db.execute(sql`
    UPDATE receipt_jobs
    SET status = CASE WHEN attempts >= ${MAX_ATTEMPTS} THEN 'failed' ELSE 'queued' END,
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
