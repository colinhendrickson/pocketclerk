import { eq } from "drizzle-orm";
import { after, connection } from "next/server";

import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { seedDatabase } from "@/db/seed-data";
import { siteMode, type SiteMode } from "@/lib/site-mode";

/**
 * The public demo at pocket-clerk.com: shared by every visitor, put back to the
 * seed every hour, and on demand at most every five minutes.
 */

const HOUR_MS = 60 * 60 * 1000;
const START_OVER_MS = 5 * 60 * 1000;

/** Whether the hourly reset is due. A demo never reset is due now. */
export function resetDue(lastReset: Date | null, now: Date): boolean {
  return lastReset === null || now.getTime() - lastReset.getTime() >= HOUR_MS;
}

/** Whether Start over may run again, so pressing it repeatedly does nothing. */
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
 * Whether this is the demo. Needs both the deployment's mode and the database's
 * own flag, so a school's copy with demo mode set by mistake still refuses the
 * demo's powers, such as signing anyone in as an administrator.
 */
export async function isDemo(): Promise<boolean> {
  if (siteMode() !== "demo") return false;
  return (await demoRow())?.isDemo === true;
}

/**
 * What is wrong when the deployment's mode and its database disagree, for
 * /api/health, or null when they agree. Either way round is a setup mistake:
 * demo mode on a school's database replaces the cart with the landing page and
 * only logs email; a school's copy on the demo's database shows made-up data.
 */
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

/** When the demo was last put back, or null if it never was or this is not it. */
export async function lastDemoReset(): Promise<Date | null> {
  if (siteMode() !== "demo") return null;
  const row = await demoRow();
  return row?.isDemo ? row.demoResetAt : null;
}

/**
 * Puts the demo back if the hour is up. Called by the layouts; the reset runs
 * after the response, so the visitor who triggers it is not kept waiting, and
 * the next page they open is the fresh cart.
 */
export async function maybeResetDemo(): Promise<void> {
  if (siteMode() !== "demo") return;
  // Render at request time. Without this the landing page is prerendered, so
  // this check would run once, during the build, and never for a visitor.
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
