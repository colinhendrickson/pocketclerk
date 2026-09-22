import { NextResponse } from "next/server";

import { deliverQueuedEmails } from "@/lib/deliver-receipts";

export const dynamic = "force-dynamic";

/**
 * Scheduled sweep for the email queue.
 *
 * Most receipts go out moments after the sale, from `after()` on the order
 * itself. This exists to catch what that attempt could not deliver: a provider
 * outage, a transient network failure, a job queued while the mail service was
 * down. Running it concurrently with a post-order attempt is safe, because jobs
 * are claimed with a guarded atomic update.
 *
 * Protected by a shared secret when one is configured. The public demo sets
 * none and the route runs openly there, where there is nothing to protect.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const provided = request.headers.get("authorization");
    if (provided !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.json(await deliverQueuedEmails(50));
}

/** Vercel Cron issues GET requests. */
export const GET = POST;
