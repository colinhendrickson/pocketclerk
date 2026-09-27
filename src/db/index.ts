import { waitUntil } from "@vercel/functions";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Database client.
 *
 * `DATABASE_URL` is the pooled runtime connection; `DIRECT_URL` is for
 * migrations only. The connection is opened lazily on first query so that
 * `next build` does not need a reachable database. In development the client is
 * cached on `globalThis` so hot reloads do not leak pools.
 */

const globalForDb = globalThis as unknown as {
  pocketclerkSql?: ReturnType<typeof postgres>;
  pocketclerkDb?: ReturnType<typeof drizzle<typeof schema>>;
};

/**
 * The pooled runtime connection. Falls back to `POSTGRES_URL`, the name
 * Vercel's Supabase integration provisions.
 */
export function runtimeConnectionString(): string | undefined {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  return url ? sessionPoolerUrl(url) : undefined;
}

/**
 * Rewrites a Supabase transaction-pooler URL (port 6543) to the session pooler
 * (port 5432) on the same host. The transaction pooler can split postgres.js's
 * two-round-trip parameterized queries across backends and hang them. See
 * docs/adr/0008-session-pooler-and-idle-connections.md.
 */
export function sessionPoolerUrl(url: string): string {
  return url.replace(/(@[^/?#]*\.pooler\.supabase\.com):6543(?=[/?#]|$)/, "$1:5432");
}

/** Seconds a quiet connection is kept before the client closes it. */
export const IDLE_TIMEOUT_SECONDS = 5;

export function clientOptions(connectionString: string, production: boolean) {
  // Prepared statements are unsafe in transaction mode, and a pooler URL may
  // still arrive in that mode (e.g. a hand-set variable), so disable them for
  // any pooler connection.
  const pooled =
    connectionString.includes("pooler.supabase.com") ||
    connectionString.includes(":6543");

  return {
    // One connection per function instance; the pooler handles concurrency.
    max: production ? 1 : 5,
    prepare: !pooled,
    // The pooler silently drops idle connections; close them first.
    // keepAwakeWhileUsed ensures this timer can fire on Vercel.
    idle_timeout: IDLE_TIMEOUT_SECONDS,
    // Recycle long-lived connections regardless of activity.
    max_lifetime: 60 * 5,
    // Fail before an upstream proxy timeout would mask the error.
    connect_timeout: 10,
  };
}

/**
 * Allowance for the query itself. The hold starts when a query is built, while
 * the idle timeout starts when it finishes.
 */
const QUERY_ALLOWANCE_MS = 5_000;

let holdTimer: ReturnType<typeof setTimeout> | undefined;
let releaseHold: (() => void) | undefined;

/**
 * Wraps a database handle so each use keeps the Vercel instance awake until the
 * connection's idle timeout has closed it.
 *
 * Vercel suspends an instance after the response and `waitUntil` work finish,
 * and a suspended process runs no timers, so an idle connection would survive
 * into the next request as a dead socket. Each use re-arms a single `waitUntil`
 * hold that outlasts the idle timeout (the same approach as Vercel's
 * `attachDatabasePool`, which does not support postgres.js). No-op off Vercel.
 */
export function keepAwakeWhileUsed<T extends object>(getTarget: () => T, idleSeconds: number): T {
  return new Proxy({} as T, {
    get(_target, property, receiver) {
      holdUntilIdle(idleSeconds);
      return Reflect.get(getTarget(), property, receiver);
    },
  });
}

function holdUntilIdle(idleSeconds: number) {
  if (!process.env.VERCEL) return;
  if (holdTimer) clearTimeout(holdTimer);
  releaseHold?.();
  const hold = new Promise<void>((resolve) => {
    releaseHold = resolve;
  });
  holdTimer = setTimeout(() => releaseHold?.(), idleSeconds * 1000 + QUERY_ALLOWANCE_MS);
  waitUntil(hold);
}

function connect() {
  const connectionString = runtimeConnectionString();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local, then run `pnpm db:up`.",
    );
  }

  const client =
    globalForDb.pocketclerkSql ??
    postgres(connectionString, clientOptions(connectionString, process.env.NODE_ENV === "production"));

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

/** Lazily connected client; the connection is created on first use. */
export const db = keepAwakeWhileUsed(instance, IDLE_TIMEOUT_SECONDS);

/** The raw postgres.js client, for scripts that need to close the pool. */
export function getClient() {
  instance();
  if (!globalForDb.pocketclerkSql) throw new Error("Database is not connected.");
  return globalForDb.pocketclerkSql;
}

export { schema };
export type Db = ReturnType<typeof drizzle<typeof schema>>;
