"use server";

import {
  buildReceipt,
  claimJobsForShift,
  markFailed,
  recordPrintResult,
} from "@/lib/receipt-jobs";
import { assertPairedDevice } from "@/app/(student)/require-device";
import { getActiveShift } from "@/lib/queries";
import { getShiftSession } from "@/lib/session";
import { isUuid } from "@/lib/validate";
import type { Receipt } from "@/providers/renderer/receipt";

/**
 * The tablet's side of the receipt queue. The printer is paired over Bluetooth,
 * so the tablet claims its own print jobs and reports results. Claims are
 * scoped to the shift in the signed session cookie. See
 * docs/adr/0009-receipts-over-web-bluetooth.md.
 */

export interface PendingPrint {
  jobId: string;
  receipt: Receipt;
}

/** How many print jobs a tablet takes at once. */
const PRINT_BATCH = 5;

/**
 * Claims up to `PRINT_BATCH` queued print jobs for the current shift, marking
 * them `processing` and incrementing attempts so a crash mid-print retries
 * rather than loses the job.
 */
export async function claimPrintJobs(): Promise<PendingPrint[]> {
  await assertPairedDevice();
  const shiftId = await getShiftSession();
  if (!shiftId) return [];

  const shift = await getActiveShift(shiftId);
  if (!shift) return [];

  const jobs = await claimJobsForShift(shift.id, "print", PRINT_BATCH);
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
 * Records a print outcome. Failures requeue the job until attempts run out.
 */
export async function reportPrintResult(
  jobId: string,
  ok: boolean,
  error?: string,
): Promise<void> {
  await assertPairedDevice();
  if (!isUuid(jobId) || typeof ok !== "boolean") return;

  const shiftId = await getShiftSession();
  if (!shiftId) return;
  const shift = await getActiveShift(shiftId);
  if (!shift) return;

  // Scoped to jobs this shift claimed; anything else is ignored.
  await recordPrintResult(
    jobId,
    shift.id,
    ok ? { ok: true } : { ok: false, error: typeof error === "string" ? error : "Print failed." },
  );
}
