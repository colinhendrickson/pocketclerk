"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { receiptJobs } from "@/db/schema";
import { isUuid } from "@/lib/validate";

import { requireAdmin } from "../require-admin";

/**
 * Requeues a failed receipt job with its attempt counter reset. Only `failed`
 * jobs qualify, and the status is in the UPDATE predicate (not checked first)
 * so a queued or sent job can never be resent. See
 * docs/adr/0002-receipt-job-queue.md.
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
 * Deletes a job that will never succeed. A hard delete is fine here: the order
 * is the permanent record, and the job is only pending work.
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
