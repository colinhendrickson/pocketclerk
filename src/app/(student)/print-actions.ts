"use server";

import {
  buildReceipt,
  claimCartPrintJobs,
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
 * so the tablet claims print jobs and reports results. There is one cart iPad
 * per school, so a paired device with an open shift prints every shift's
 * recent receipts. See docs/adr/0009-receipts-over-web-bluetooth.md.
 */

export interface PendingPrint {
  jobId: string;
  receipt: Receipt;
}

/** How many print jobs a tablet takes at once. */
const PRINT_BATCH = 5;

/** A paired device with an open shift in its session may print. */
async function canPrint(): Promise<boolean> {
  await assertPairedDevice();
  const shiftId = await getShiftSession();
  return shiftId !== null && (await getActiveShift(shiftId)) !== null;
}

/**
 * Claims up to `PRINT_BATCH` of the cart's queued print jobs, marking them
 * `processing` and incrementing attempts so a crash mid-print retries rather
 * than loses the job.
 */
export async function claimPrintJobs(): Promise<PendingPrint[]> {
  if (!(await canPrint())) return [];

  const jobs = await claimCartPrintJobs(PRINT_BATCH);
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
 * Needs only a paired device, so a print that finishes just after clock-out
 * is still recorded rather than reprinted.
 */
export async function reportPrintResult(
  jobId: string,
  ok: boolean,
  error?: string,
): Promise<void> {
  await assertPairedDevice();
  if (!isUuid(jobId) || typeof ok !== "boolean") return;

  // Only a claimed print job can be settled; anything else is ignored.
  await recordPrintResult(
    jobId,
    ok ? { ok: true } : { ok: false, error: typeof error === "string" ? error : "Print failed." },
  );
}
