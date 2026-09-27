import { NextResponse } from "next/server";

import { hasBearer } from "@/lib/bearer";
import { deliverQueuedEmails } from "@/lib/deliver-receipts";
import { siteMode } from "@/lib/site-mode";

export const dynamic = "force-dynamic";

/**
 * Scheduled sweep for email receipts the post-order `after()` attempt could not
 * deliver. Safe to run concurrently with it: jobs are claimed with a guarded
 * atomic update.
 *
 * Authenticated with `CRON_SECRET` as a bearer token (Vercel Cron sends it
 * automatically). Without a secret the route is open only in the demo and in
 * development; a production deployment refuses all callers with a 503.
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
  } else if (!hasBearer(request, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await deliverQueuedEmails(50));
}

/** Vercel Cron issues GET requests. */
export const GET = POST;
