import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { hasBearer } from "@/lib/bearer";
import { missingRequiredConfig } from "@/lib/config";
import { databaseIsDemo, siteModeProblem } from "@/lib/demo";
import { migrationStatus, type MigrationStatus } from "@/lib/migration-status";
import { siteMode } from "@/lib/site-mode";
import { TIME_ZONE } from "@/lib/time";

export const dynamic = "force-dynamic";

/**
 * Deployment readiness check. Reports the names of missing settings (never
 * their values) and whether the database is reachable and fully migrated.
 * How the deployment is set up (pairing, email, cron) is included only in
 * development or for a request carrying `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const missing = missingRequiredConfig();

  let database: "ok" | "unreachable" | "migrations pending" | "schema newer than code" = "ok";
  let tables = 0;
  let migrations: MigrationStatus | null = null;

  try {
    const [row] = await db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'`,
    );
    tables = row?.n ?? 0;

    // Table count alone misses column-only migrations; compare migrations too.
    migrations = await migrationStatus();
    if (migrations.state === "behind" || migrations.state === "never migrated") {
      database = "migrations pending";
    } else if (migrations.state === "ahead") {
      database = "schema newer than code";
    }
  } catch {
    database = "unreachable";
  }

  const setup = {
    // A wrong zone fails silently (receipt times are off), so surface it.
    timeZone: TIME_ZONE,
    devicePairing: process.env.DEVICE_CODE
      ? "on, student screens require a paired device"
      : "OFF, student screens are open to anyone with the address",
    email: process.env.RESEND_API_KEY
      ? process.env.EMAIL_FROM
        ? "configured"
        : "RESEND_API_KEY set but EMAIL_FROM missing"
      : "not configured, receipts will be logged instead of sent",
    // Refused outside the demo when unset, so failed receipts are never retried.
    receiptRetry: process.env.CRON_SECRET
      ? "scheduled sweep protected by CRON_SECRET"
      : "CRON_SECRET not set: the nightly retry of failed receipts is refused",
    // Not `?? fallback`, which would report an empty string as configured.
    appUrl:
      (process.env.NEXT_PUBLIC_APP_URL ?? "").length > 0
        ? process.env.NEXT_PUBLIC_APP_URL
        : "set but empty, or not set at all. Sign-in links will be wrong",
  };

  const mode = siteMode();
  const isDemoDatabase = database === "ok" ? await databaseIsDemo() : null;
  const modeProblem = isDemoDatabase === null ? null : siteModeProblem(mode, isDemoDatabase);

  const ready = missing.length === 0 && database === "ok" && modeProblem === null;

  return NextResponse.json(
    {
      ready,
      missingRequired: missing,
      database,
      migrations: migrations && {
        applied: migrations.applied,
        expected: migrations.expected,
        ...(migrations.state === "behind" || migrations.state === "never migrated"
          ? { action: "Run `pnpm db:migrate` against the production DIRECT_URL." }
          : {}),
      },
      tables,
      siteMode: modeProblem ?? mode,
      ...(showSetup(request) ? { setup } : {}),
    },
    { status: ready ? 200 : 503 },
  );
}

function showSetup(request: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const secret = process.env.CRON_SECRET;
  return secret ? hasBearer(request, secret) : false;
}
