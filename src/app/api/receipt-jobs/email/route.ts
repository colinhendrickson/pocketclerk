import { NextResponse } from "next/server";

import {
  buildReceipt,
  claimJobs,
  markFailed,
  markSent,
  receiptEmailFor,
} from "@/lib/receipt-jobs";
import { getEmailSender } from "@/providers/email";

export const dynamic = "force-dynamic";

/**
 * Email consumer for the receipt queue.
 *
 * Called after an order completes and again by a scheduler as a sweep, so a
 * job whose first delivery failed is retried without anyone noticing. Running
 * it twice at once is safe: jobs are claimed with a guarded atomic update, so
 * the second run finds nothing to do rather than sending twice.
 *
 * Protected by a shared secret when one is configured. On the public demo there
 * is nothing to protect and no key is set, so the route runs openly there and
 * is locked down wherever real receipts are sent.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const provided = request.headers.get("authorization");
    if (provided !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const jobs = await claimJobs("email", 10);
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
        // No address to send to. Nothing will ever make this deliverable, so it
        // is retired rather than retried until it exhausts its attempts.
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

  return NextResponse.json({ claimed: jobs.length, sent, failed });
}
