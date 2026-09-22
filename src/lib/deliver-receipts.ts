import {
  buildReceipt,
  claimJobs,
  markFailed,
  markSent,
  receiptEmailFor,
} from "@/lib/receipt-jobs";
import { getEmailSender } from "@/providers/email";

/**
 * Drains queued email receipts.
 *
 * Extracted from the API route so it can also run immediately after an order,
 * via `after()`, once the response has already gone back to the student. That
 * matters on Vercel's free tier, where a cron job may only run once a day: a
 * teacher would otherwise wait until tomorrow for a receipt.
 *
 * The scheduled run is still worth having, as a sweep for anything the
 * post-order attempt could not deliver. Running both at once is safe, because
 * jobs are claimed with a guarded atomic update.
 */
export interface DeliveryOutcome {
  claimed: number;
  sent: number;
  failed: number;
}

export async function deliverQueuedEmails(limit = 10): Promise<DeliveryOutcome> {
  const jobs = await claimJobs("email", limit);
  const sender = getEmailSender();
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
        // Nothing will ever make this deliverable, so it is retired rather than
        // retried until it exhausts its attempts.
        await markFailed(job.id, "No email address saved for this teacher.");
        failed += 1;
        continue;
      }

      const result = await sender.send(to, receipt);
      if (result.ok) {
        await markSent(job.id);
        sent += 1;
      } else {
        await markFailed(job.id, result.error ?? "Send failed.");
        failed += 1;
      }
    } catch (error) {
      await markFailed(
        job.id,
        error instanceof Error ? error.message : "Unexpected error.",
      );
      failed += 1;
    }
  }

  return { claimed: jobs.length, sent, failed };
}
