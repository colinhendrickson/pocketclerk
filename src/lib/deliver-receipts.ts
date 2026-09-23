import {
  buildReceipt,
  claimJobs,
  markFailed,
  markSent,
  receiptEmailFor,
} from "@/lib/receipt-jobs";
import { getEmailSender, type EmailSender } from "@/providers/email";

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
        // Nothing will ever make this deliverable, so it is retired rather than
        // retried until it exhausts its attempts.
        await markFailed(job.id, "No email address saved for this teacher.");
        failed += 1;
        continue;
      }

      // The job id makes a retry of an already-delivered receipt a no-op at
      // the provider, instead of a second email to the teacher.
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
      // Recording the failure can itself fail, on the same dead connection or
      // bug that caused it. That must not escape the loop: it would abandon
      // every remaining job in the batch mid-flight. The job is reclaimed once
      // it has sat in processing long enough, so logging is enough here.
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
