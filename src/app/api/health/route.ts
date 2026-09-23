import { NextResponse } from "next/server";

import { db } from "@/db";
import { missingRequiredConfig } from "@/lib/config";
import { migrationStatus, type MigrationStatus } from "@/lib/migration-status";
import { TIME_ZONE } from "@/lib/time";
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

  let database: "ok" | "unreachable" | "migrations pending" | "schema newer than code" = "ok";
  let tables = 0;
  let migrations: MigrationStatus | null = null;

  try {
    const [row] = await db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'`,
    );
    tables = row?.n ?? 0;

    // Counting tables said "ready" on the first real deployment while a new
    // column was missing, because a migration can change a table without
    // adding one. The migration count is the actual question: is the database
    // at the schema this code was written for?
    migrations = await migrationStatus();
    if (migrations.state === "behind" || migrations.state === "never migrated") {
      database = "migrations pending";
    } else if (migrations.state === "ahead") {
      database = "schema newer than code";
    }
  } catch {
    database = "unreachable";
  }

  const optional = {
    // Reported because a wrong zone is silent: every page still loads, and the
    // only symptom is receipts printed hours off.
    timeZone: TIME_ZONE,
    devicePairing: process.env.DEVICE_CODE
      ? "on, student screens require a paired device"
      : "OFF, student screens are open to anyone with the address",
    email: process.env.RESEND_API_KEY
      ? process.env.EMAIL_FROM
        ? "configured"
        : "RESEND_API_KEY set but EMAIL_FROM missing"
      : "not configured, receipts will be logged instead of sent",
    // Deliberately not `?? fallback`: a variable that exists but holds an empty
    // string is a different and more confusing failure than one that is absent,
    // and `??` reports the empty one as configured. This deployment hit exactly
    // that, and the distinction is what made it diagnosable.
    // Refused outside the demo when unset, so failed receipts are never retried.
    receiptRetry: process.env.CRON_SECRET
      ? "scheduled sweep protected by CRON_SECRET"
      : "CRON_SECRET not set: the nightly retry of failed receipts is refused",
    appUrl:
      (process.env.NEXT_PUBLIC_APP_URL ?? "").length > 0
        ? process.env.NEXT_PUBLIC_APP_URL
        : "set but empty, or not set at all. Sign-in links will be wrong",
  };

  const ready = missing.length === 0 && database === "ok";

  return NextResponse.json(
    {
      ready,
      missingRequired: missing,
      database,
      migrations: migrations && {
        applied: migrations.applied,
        expected: migrations.expected,
        // Says what to do, because the person reading this is mid-deploy.
        ...(migrations.state === "behind" || migrations.state === "never migrated"
          ? { action: "Run `pnpm db:migrate` against the production DIRECT_URL." }
          : {}),
      },
      tables,
      optional,
    },
    { status: ready ? 200 : 503 },
  );
}
