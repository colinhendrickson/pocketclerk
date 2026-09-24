// Must come first: it populates process.env before anything reads DATABASE_URL.
import "../src/db/load-env";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { DEMO_DATABASE, demoDatabaseUrl } from "../tests/e2e/demo-database";

/**
 * Prepares the database the demo spec runs against: creates it beside the main
 * one if missing, applies the migrations, and seeds it as the demo's.
 *
 * `pnpm test:e2e` runs it first. On its own:
 *
 *   pnpm tsx scripts/demo-db.ts
 */
async function main() {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL must be set.");
  const url = demoDatabaseUrl(base);

  const server = postgres(base, { max: 1, onnotice: () => {} });
  const [found] = await server`SELECT 1 FROM pg_database WHERE datname = ${DEMO_DATABASE}`;
  if (!found) await server.unsafe(`CREATE DATABASE ${DEMO_DATABASE}`);
  await server.end();

  const client = postgres(url, { max: 1, onnotice: () => {} });
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  await client.end();

  // The app's client reads DATABASE_URL when first imported, so point it at
  // the demo's database before importing the seed.
  process.env.DATABASE_URL = url;
  const { seedDatabase } = await import("../src/db/seed-data");
  const { getClient } = await import("../src/db/index");
  const result = await seedDatabase({ demo: true });
  await getClient().end();
  console.log(`Demo database ${DEMO_DATABASE}: migrated, ${result}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
