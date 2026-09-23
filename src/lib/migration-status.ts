import { sql } from "drizzle-orm";

import { db } from "@/db";

import journal from "../../drizzle/meta/_journal.json";

/**
 * Is the database at the schema this code was written for?
 *
 * Deploys and migrations are separate on purpose: code ships on every push, and
 * a migration runs only when a person runs it against live data. The cost is
 * that they can drift, and when the code is ahead the failure is a 500 from
 * whichever query first touches the missing column. The first real deployment
 * hit exactly that: a new column shipped, the migration had not been run, and
 * the health check still said "ready" because it only counted tables.
 *
 * The journal is imported rather than read from disk so it is bundled into the
 * function: the deployed code knows how many migrations it expects even where
 * the drizzle folder does not exist.
 */

export const EXPECTED_MIGRATIONS: number = journal.entries.length;

export type MigrationStatus =
  | { state: "current"; applied: number; expected: number }
  | { state: "behind"; applied: number; expected: number }
  | { state: "ahead"; applied: number; expected: number }
  | { state: "never migrated"; applied: 0; expected: number };

/**
 * Compares the migrations drizzle has recorded against the journal.
 *
 * "ahead" is possible and worth naming: it means the database was migrated by
 * newer code than is deployed, typically a rollback, and the running code may
 * be reading a schema it does not know about.
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
