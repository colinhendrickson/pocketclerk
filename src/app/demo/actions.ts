"use server";

import { sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { seedDatabase } from "@/db/seed-data";
import { startAdminSession } from "@/lib/admin-auth";
import { canStartOver, isDemo, lastDemoReset } from "@/lib/demo";

/**
 * Demo-only actions. Server actions are open endpoints, so each checks
 * `isDemo()` itself and does nothing on a school's copy.
 */

/** Signs the visitor in as the seeded administrator, without an email. */
export async function enterDemoAdmin(): Promise<void> {
  if (!(await isDemo())) redirect("/");

  const [admin] = await db.execute<{ person_id: string }>(
    sql`SELECT person_id FROM admin_users ORDER BY created_at LIMIT 1`,
  );
  if (!admin || !(await startAdminSession(admin.person_id))) redirect("/");
  redirect("/admin");
}

/** Resets the demo now; a no-op within five minutes of the last reset. */
export async function startOver(): Promise<void> {
  if (await isDemo()) {
    if (canStartOver(await lastDemoReset(), new Date())) {
      await seedDatabase({ demo: true });
    }
  }
  redirect("/");
}
