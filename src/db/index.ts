import { waitUntil } from "@vercel/functions";
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

/**
 * The pooled runtime connection.
 *
 * `POSTGRES_URL` is the fallback because that is the name Vercel's Supabase
 * integration provisions, along with `POSTGRES_URL_NON_POOLING` for the direct
 * one. Reading both means the integration can be switched on and the app simply
 * works, and the credentials stay in sync when the database password is
 * rotated, instead of two variables quietly going stale.
 */
export function runtimeConnectionString(): string | undefined {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
}

/** Seconds a quiet connection is kept before the client closes it. */
export const IDLE_TIMEOUT_SECONDS = 5;

export function clientOptions(connectionString: string, production: boolean) {
  // Supabase's transaction pooler (Supavisor) hands a different backend
  // connection to each statement, so a prepared statement created on one is not
  // there for the next. Leaving prepared statements on produces failures that
  // appear only in production and never locally, which is the worst shape a bug
  // can have. Detected from the connection string rather than from NODE_ENV so
  // that pointing a local process at the pooler behaves the same way.
  const pooled =
    connectionString.includes("pooler.supabase.com") ||
    connectionString.includes(":6543");

  return {
    // One connection per function instance; the pooler handles concurrency.
    max: production ? 1 : 5,
    prepare: !pooled,
    // The pooler, and any NAT on the way to it, drops quiet connections
    // without telling either end, and postgres.js keeps idle connections
    // forever by default. So quiet connections are closed here, and
    // keepAwakeWhileUsed makes sure that closing gets to run on Vercel.
    idle_timeout: IDLE_TIMEOUT_SECONDS,
    // Recycle even a busy connection, so nothing lives long enough to meet a
    // drop window we did not anticipate.
    max_lifetime: 60 * 5,
    // Fail in ten seconds with an error that names the problem, instead of
    // thirty seconds of nothing behind a proxy that gives up first.
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
 * Wraps a database handle so that using it keeps the function instance awake
 * until its connection has gone idle and been closed.
 *
 * Vercel suspends an instance once its response and any `waitUntil` work are
 * done, and a suspended process runs no timers. So the idle timeout above never
 * fired between requests: the connection slept with the instance, the pooler
 * dropped it meanwhile, and the next request's query went to a dead socket.
 * With one connection per instance, every request after it queued behind that
 * query until the platform killed the instance at 300 seconds.
 *
 * Every use re-arms one hold, handed to `waitUntil`, that outlasts the idle
 * timeout, so the client closes the connection while the instance is still
 * running. It is the mechanism of Vercel's own `attachDatabasePool`, which
 * does not support postgres.js. Outside Vercel nothing suspends, so there is
 * nothing to hold, and scripts are not kept running by the timer.
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

/**
 * Proxy so `db.select(...)` reads naturally at call sites while the underlying
 * connection is still created on first use.
 */
export const db = keepAwakeWhileUsed(instance, IDLE_TIMEOUT_SECONDS);

/** The raw postgres.js client, for scripts that need to close the pool. */
export function getClient() {
  instance();
  if (!globalForDb.pocketclerkSql) throw new Error("Database is not connected.");
  return globalForDb.pocketclerkSql;
}

export { schema };
export type Db = ReturnType<typeof drizzle<typeof schema>>;
