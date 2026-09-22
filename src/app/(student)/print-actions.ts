"use server";

import {
  buildReceipt,
  claimJobsForShift,
  markFailed,
  markSent,
} from "@/lib/receipt-jobs";
import { getActiveShift } from "@/lib/queries";
import { getShiftSession } from "@/lib/session";
import type { Receipt } from "@/providers/renderer/receipt";

/**
 * The tablet's half of the receipt queue.
 *
 * The printer is paired to this device over Bluetooth, so no server can reach
 * it. The tablet therefore claims its own print jobs, sends them to the
 * printer, and reports the outcome back.
 *
 * Every claim is scoped to the shift in the signed session cookie, so a tablet
 * can only ever print receipts for sales it made. Students have no database
 * identity, which is exactly why that check lives here rather than in a policy.
 */

export interface PendingPrint {
  jobId: string;
  receipt: Receipt;
}

/**
 * Claims up to five queued print jobs for the current shift.
 *
 * Claiming marks them `processing` and increments their attempt count, so a
 * tablet that crashes mid-print leaves a job that is retried rather than one
 * that is silently lost.
 */
export async function claimPrintJobs(): Promise<PendingPrint[]> {
  const shiftId = await getShiftSession();
  if (!shiftId) return [];

  const shift = await getActiveShift(shiftId);
  if (!shift) return [];

  const jobs = await claimJobsForShift(shift.id, "print", 5);
  const out: PendingPrint[] = [];

  for (const job of jobs) {
    const receipt = await buildReceipt(job.orderId);
    if (receipt) {
      out.push({ jobId: job.id, receipt });
    } else {
      await markFailed(job.id, "Order no longer exists.");
    }
  }

  return out;
}

/**
 * Reports what the printer did.
 *
 * A failure returns the job to the queue until it runs out of attempts, so a
 * printer that was out of paper prints the backlog once it is reloaded.
 */
export async function reportPrintResult(
  jobId: string,
  ok: boolean,
  error?: string,
): Promise<void> {
  const shiftId = await getShiftSession();
  if (!shiftId) return;

  if (ok) {
    await markSent(jobId);
  } else {
    await markFailed(jobId, error ?? "Print failed.");
  }
}
