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
 * Connection is deferred until the first query rather than established at
 * import time. A build collects routes by importing their modules, so an eager
 * connection would make `next build` require a reachable database — which it
 * does not, and which would mean standing up Postgres just to produce static
 * assets in CI.
 *
 * In development the client is cached on `globalThis` so Next.js hot reloads do
 * not leak a new pool on every edit.
 */

const globalForDb = globalThis as unknown as {
  pocketclerkSql?: ReturnType<typeof postgres>;
  pocketclerkDb?: ReturnType<typeof drizzle<typeof schema>>;
};

function connect() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local, then run `pnpm db:up`.",
    );
  }

  const client =
    globalForDb.pocketclerkSql ??
    postgres(connectionString, {
      // One connection per serverless invocation; the pooler handles concurrency.
      max: process.env.NODE_ENV === "production" ? 1 : 5,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.pocketclerkSql = client;
  }

  return { client, db: drizzle(client, { schema }) };
}

function instance() {
  if (!globalForDb.pocketclerkDb) {
    const { client, db } = connect();
    globalForDb.pocketclerkSql = client;
    globalForDb.pocketclerkDb = db;
  }
  return globalForDb.pocketclerkDb;
}

/**
 * Proxy so `db.select(...)` reads naturally at call sites while the underlying
 * connection is still created on first use.
 */
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, property, receiver) {
    return Reflect.get(instance(), property, receiver);
  },
});

/** The raw postgres.js client, for scripts that need to close the pool. */
export function getClient() {
  instance();
  if (!globalForDb.pocketclerkSql) throw new Error("Database is not connected.");
  return globalForDb.pocketclerkSql;
}

export { schema };
export type Db = ReturnType<typeof drizzle<typeof schema>>;
