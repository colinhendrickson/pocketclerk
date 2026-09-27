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
 * Jobs are claimed with a single status-guarded `UPDATE ... RETURNING`, so
 * concurrent consumers are serialized by Postgres and each job is returned to
 * at most one of them. See docs/adr/0002-receipt-job-queue.md.
 */

/** How many times a job is retried before it is left for a human. */
export const MAX_ATTEMPTS = 5;

/** Truncation limit for stored error messages. */
const MAX_ERROR_LENGTH = 500;

/** Drizzle's `execute` generic requires an index signature on the row type. */
export interface ClaimedJob extends Record<string, unknown> {
  id: string;
  orderId: string;
  attempts: number;
}

/**
 * How long a job may sit in `processing` before it is presumed abandoned (its
 * consumer died) and becomes claimable again. Far longer than any real
 * delivery; re-sending is safe because the job id is the idempotency key.
 */
const STALE_PROCESSING = sql`interval '10 minutes'`;

/**
 * Atomically moves up to `limit` claimable jobs (queued, or stale in
 * `processing`) on this channel to `processing` and returns them.
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
 * Requeues a job, or marks it `failed` (keeping its last error for the admin
 * monitor) once its attempts are exhausted.
 */
export async function markFailed(jobId: string, error: string): Promise<void> {
  // Casts required: a CASE of string literals is text, not the enum type.
  await db.execute(sql`
    UPDATE receipt_jobs
    SET status = CASE
          WHEN attempts >= ${MAX_ATTEMPTS} THEN 'failed'::receipt_status
          ELSE 'queued'::receipt_status
        END,
        last_error = ${error.slice(0, MAX_ERROR_LENGTH)},
        updated_at = now()
    WHERE id = ${jobId}
  `);
}

export type PrintOutcome = { ok: true } | { ok: false; error: string };

/**
 * Settles a print job reported by the tablet. Only a `processing` print job
 * belonging to this shift can be settled; returns false otherwise.
 */
export async function recordPrintResult(
  jobId: string,
  shiftId: string,
  outcome: PrintOutcome,
): Promise<boolean> {
  const error = outcome.ok ? null : outcome.error.slice(0, MAX_ERROR_LENGTH);
  const rows = await db.execute(sql`
    UPDATE receipt_jobs
    SET status = CASE
          WHEN ${outcome.ok} THEN 'sent'::receipt_status
          WHEN attempts >= ${MAX_ATTEMPTS} THEN 'failed'::receipt_status
          ELSE 'queued'::receipt_status
        END,
        last_error = ${error},
        updated_at = now()
    WHERE id = ${jobId}
      AND channel = 'print'
      AND status = 'processing'
      AND order_id IN (SELECT id FROM orders WHERE shift_id = ${shiftId})
    RETURNING id
  `);
  return rows.length > 0;
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

  // Use snapshot columns so reprints show what was actually charged.
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
