import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { deliverQueuedEmails } from "@/lib/deliver-receipts";
import { siteMode } from "@/lib/site-mode";

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
 * Protected by a shared secret. Vercel Cron sends it automatically as a bearer
 * token once CRON_SECRET is set.
 *
 * Without a secret the route used to run for anyone. That is intended on the
 * public demo and in development, and wrong on a real deployment, where it let
 * any stranger trigger a sweep that sends mail from the school's account. A
 * real deployment without a secret now refuses and says why in the log, and
 * /api/health reports it, rather than quietly running in the open.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    const openByDesign = siteMode() === "demo" || process.env.NODE_ENV !== "production";
    if (!openByDesign) {
      console.error(
        "[config] CRON_SECRET is not set, so the receipt sweep is refusing all callers. Set it and redeploy.",
      );
      return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
    }
  } else if (!bearerMatches(request.headers.get("authorization"), expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await deliverQueuedEmails(50));
}

/**
 * Constant-time comparison, so the response time does not reveal how many
 * leading characters of a guess were right.
 */
function bearerMatches(header: string | null, secret: string): boolean {
  const provided = Buffer.from(header ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  return provided.length === wanted.length && timingSafeEqual(provided, wanted);
}

/** Vercel Cron issues GET requests. */
export const GET = POST;
