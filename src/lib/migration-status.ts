import { sql } from "drizzle-orm";

import { db } from "@/db";

import journal from "../../drizzle/meta/_journal.json";

/**
 * Whether the database schema matches this code. Deploys and migrations run
 * separately, so they can drift. The journal is imported (not read from disk)
 * so it is bundled with the deployed function.
 */

export const EXPECTED_MIGRATIONS: number = journal.entries.length;

export type MigrationStatus =
  | { state: "current"; applied: number; expected: number }
  | { state: "behind"; applied: number; expected: number }
  | { state: "ahead"; applied: number; expected: number }
  | { state: "never migrated"; applied: 0; expected: number };

/**
 * Compares applied migrations against the journal. "ahead" means newer code
 * migrated the database than is deployed, typically after a rollback.
 */
export async function migrationStatus(): Promise<MigrationStatus> {
  const expected = EXPECTED_MIGRATIONS;

  const [exists] = await db.execute<{ present: boolean }>(sql`
    SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present
  `);
  if (!exists?.present) return { state: "never migrated", applied: 0, expected };

  const [row] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations
  `);
  const applied = row?.n ?? 0;

  if (applied === expected) return { state: "current", applied, expected };
  return applied < expected
    ? { state: "behind", applied, expected }
    : { state: "ahead", applied, expected };
}
