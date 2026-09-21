import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Database client.
 *
 * `DATABASE_URL` is the pooled connection used at runtime. Serverless functions
 * open many short-lived connections and a transaction pooler absorbs them;
 * pointing the app at the direct connection exhausts Postgres' connection slots
 * under any real traffic. Migrations use `DIRECT_URL` instead, because the
 * pooler strips the session-level features drizzle-kit relies on.
 *
 * In development the client is cached on `globalThis` so Next.js hot reloads do
 * not leak a new pool on every edit.
 */

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local, then run `pnpm db:up`.",
  );
}

const globalForDb = globalThis as unknown as {
  pocketclerkSql?: ReturnType<typeof postgres>;
};

/**
 * The raw postgres.js client. Named `client`, not `sql`, so it cannot be
 * confused with drizzle-orm's `sql` template tag at a call site.
 * Scripts use `client.end()` to close the pool; the app never needs it.
 */
const client =
  globalForDb.pocketclerkSql ??
  postgres(connectionString, {
    // One connection per serverless invocation; the pooler handles concurrency.
    max: process.env.NODE_ENV === "production" ? 1 : 5,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pocketclerkSql = client;
}

export const db = drizzle(client, { schema });
export { client, schema };
export type Db = typeof db;
