import { eq } from "drizzle-orm";
import { after, connection } from "next/server";

import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { seedDatabase } from "@/db/seed-data";
import { siteMode, type SiteMode } from "@/lib/site-mode";

/**
 * The public demo: shared by every visitor, reset to the seed hourly, and on
 * demand at most every five minutes.
 */

const HOUR_MS = 60 * 60 * 1000;
const START_OVER_MS = 5 * 60 * 1000;

/** Whether the hourly reset is due. A demo never reset is due now. */
export function resetDue(lastReset: Date | null, now: Date): boolean {
  return lastReset === null || now.getTime() - lastReset.getTime() >= HOUR_MS;
}

/** Whether Start over may run again (rate limit on manual resets). */
export function canStartOver(lastReset: Date | null, now: Date): boolean {
  return lastReset === null || now.getTime() - lastReset.getTime() >= START_OVER_MS;
}

async function demoRow(): Promise<{ isDemo: boolean; demoResetAt: Date | null } | null> {
  try {
    const [row] = await db
      .select({ isDemo: siteSettings.isDemo, demoResetAt: siteSettings.demoResetAt })
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
      .limit(1);
    return row ?? null;
  } catch (error) {
    console.error("[demo] could not read the demo flag; treating this as not the demo", error);
    return null;
  }
}

/**
 * Whether this is the demo. Requires both the deployment mode and the
 * database's flag, so a school's copy misconfigured as a demo still refuses
 * demo-only powers such as open admin sign-in.
 */
export async function isDemo(): Promise<boolean> {
  if (siteMode() !== "demo") return false;
  return (await demoRow())?.isDemo === true;
}

/** For /api/health: describes a mismatch between site mode and database, or null. */
export function siteModeProblem(mode: SiteMode, databaseIsDemo: boolean): string | null {
  if (mode === "demo" && !databaseIsDemo) {
    return "NEXT_PUBLIC_SITE_MODE=demo on a database not seeded as the demo's. On a school's copy, remove it and redeploy; for the demo, run `pnpm seed --demo`.";
  }
  if (mode === "instance" && databaseIsDemo) {
    return "This copy is connected to the demo's database. Point DATABASE_URL at the school's own database.";
  }
  return null;
}

/** The database's own demo flag, or null if it cannot be read. */
export async function databaseIsDemo(): Promise<boolean | null> {
  const row = await demoRow();
  return row ? row.isDemo : null;
}

/** When the demo was last reset, or null if never or not the demo. */
export async function lastDemoReset(): Promise<Date | null> {
  if (siteMode() !== "demo") return null;
  const row = await demoRow();
  return row?.isDemo ? row.demoResetAt : null;
}

/** Resets the demo if the hour is up. Runs after the response, via `after()`. */
export async function maybeResetDemo(): Promise<void> {
  if (siteMode() !== "demo") return;
  // Opt into request-time rendering; otherwise this runs only at build time.
  await connection();
  const row = await demoRow();
  if (!row?.isDemo || !resetDue(row.demoResetAt, new Date())) return;
  after(async () => {
    try {
      await seedDatabase({ demo: true });
    } catch (error) {
      console.error("[demo] the hourly reset failed; the next visit will try again", error);
    }
  });
}
