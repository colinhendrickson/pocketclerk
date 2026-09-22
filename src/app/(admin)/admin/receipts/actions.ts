"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { receiptJobs } from "@/db/schema";
import { isUuid } from "@/lib/validate";

import { requireAdmin } from "../require-admin";

/**
 * Retrying a delivery that gave up.
 *
 * A job that exhausted its attempts sits in `failed` with the reason it failed.
 * Retrying resets the counter and returns it to the queue, which is the whole
 * recovery story: the administrator fixes the cause (reloads the printer,
 * corrects a mistyped address) and puts the job back.
 *
 * Only failed jobs are eligible. Retrying something already queued or already
 * sent would either do nothing or send a duplicate, so the status is part of
 * the update's predicate rather than something checked beforehand and trusted.
 */
export async function retryReceiptJob(jobId: string): Promise<boolean> {
  await requireAdmin();
  if (!isUuid(jobId)) return false;

  const rows = await db.execute(sql`
    UPDATE receipt_jobs
    SET status = 'queued', attempts = 0, last_error = NULL, updated_at = now()
    WHERE id = ${jobId} AND status = 'failed'
    RETURNING id
  `);

  revalidatePath("/admin/receipts");
  return rows.length > 0;
}

/** Returns every failed job to the queue in one statement. */
export async function retryAllFailed(): Promise<number> {
  await requireAdmin();

  const rows = await db.execute(sql`
    UPDATE receipt_jobs
    SET status = 'queued', attempts = 0, last_error = NULL, updated_at = now()
    WHERE status = 'failed'
    RETURNING id
  `);

  revalidatePath("/admin/receipts");
  return rows.length;
}

/**
 * Abandons a job that will never succeed, such as a receipt for a teacher whose
 * address was wrong and who has since been given a printed copy.
 *
 * Deleting the job rather than marking it abandoned is deliberate: the order it
 * belongs to is the permanent record, and a queue is allowed to forget work
 * nobody wants done.
 */
export async function dismissReceiptJob(jobId: string): Promise<boolean> {
  await requireAdmin();
  if (!isUuid(jobId)) return false;

  const rows = await db
    .delete(receiptJobs)
    .where(eq(receiptJobs.id, jobId))
    .returning({ id: receiptJobs.id });

  revalidatePath("/admin/receipts");
  return rows.length > 0;
}
