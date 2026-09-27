import {
  buildReceipt,
  claimJobs,
  markFailed,
  markSent,
  receiptEmailFor,
} from "@/lib/receipt-jobs";
import { getEmailSender, type EmailSender } from "@/providers/email";

/**
 * Drains queued email receipts. Runs right after an order via `after()` (the
 * daily cron alone would be too slow) and on the cron as a sweep. Concurrent
 * runs are safe because jobs are claimed with a guarded atomic update.
 * See docs/adr/0002-receipt-job-queue.md.
 */
export interface DeliveryOutcome {
  claimed: number;
  sent: number;
  failed: number;
}

export async function deliverQueuedEmails(
  limit = 10,
  sender: EmailSender = getEmailSender(),
): Promise<DeliveryOutcome> {
  const jobs = await claimJobs("email", limit);
  let sent = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      const [receipt, to] = await Promise.all([
        buildReceipt(job.orderId),
        receiptEmailFor(job.orderId),
      ]);

      if (!receipt) {
        await markFailed(job.id, "Order no longer exists.");
        failed += 1;
        continue;
      }
      if (!to) {
        // Permanently undeliverable; fail it rather than retry.
        await markFailed(job.id, "No email address saved for this teacher.");
        failed += 1;
        continue;
      }

      // The job id is the idempotency key, so a retry never sends twice.
      const result = await sender.send(to, receipt, job.id);
      if (result.ok) {
        await markSent(job.id);
        sent += 1;
      } else {
        await markFailed(job.id, result.error ?? "Send failed.");
        failed += 1;
      }
    } catch (error) {
      failed += 1;
      const reason = error instanceof Error ? error.message : "Unexpected error.";
      // Recording the failure can itself fail; that must not abandon the rest
      // of the batch. Stale processing jobs are reclaimed later.
      try {
        await markFailed(job.id, reason);
      } catch (recordError) {
        console.error(
          `[receipts] job ${job.id} failed (${reason}) and recording that also failed: ${
            recordError instanceof Error ? recordError.message : String(recordError)
          }`,
        );
      }
    }
  }

  return { claimed: jobs.length, sent, failed };
}
