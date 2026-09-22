import { NextResponse } from "next/server";

import { db } from "@/db";
import { missingRequiredConfig } from "@/lib/config";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Is this deployment actually configured?
 *
 * Written after a real deployment failed twice for reasons that were invisible
 * from outside: a missing secret surfaced only when a form was submitted, and
 * checking meant reading function logs in another tab. This answers the question
 * directly.
 *
 * It reports the NAMES of settings that are missing and never their values, and
 * it reports whether the database is reachable and migrated. That is information
 * an attacker cannot use and a person deploying the app cannot work without.
 * Everything here is already observable by anyone who can make the app fail.
 */
export async function GET(): Promise<NextResponse> {
  const missing = missingRequiredConfig();

  let database: "ok" | "unreachable" | "not migrated" = "ok";
  let tables = 0;

  try {
    const [row] = await db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'`,
    );
    tables = row?.n ?? 0;
    // The schema has fourteen tables; anything less means migrations have not
    // finished, which looks exactly like a broken app from the outside.
    if (tables < 14) database = "not migrated";
  } catch {
    database = "unreachable";
  }

  const optional = {
    email: process.env.RESEND_API_KEY
      ? process.env.EMAIL_FROM
        ? "configured"
        : "RESEND_API_KEY set but EMAIL_FROM missing"
      : "not configured, receipts will be logged instead of sent",
    // Deliberately not `?? fallback`: a variable that exists but holds an empty
    // string is a different and more confusing failure than one that is absent,
    // and `??` reports the empty one as configured. This deployment hit exactly
    // that, and the distinction is what made it diagnosable.
    appUrl:
      (process.env.NEXT_PUBLIC_APP_URL ?? "").length > 0
        ? process.env.NEXT_PUBLIC_APP_URL
        : "set but empty, or not set at all. Sign-in links will be wrong",
  };

  const ready = missing.length === 0 && database === "ok";

  return NextResponse.json(
    { ready, missingRequired: missing, database, tables, optional },
    { status: ready ? 200 : 503 },
  );
}
