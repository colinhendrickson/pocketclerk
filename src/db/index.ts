import { waitUntil } from "@vercel/functions";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Database client.
 *
 * `DATABASE_URL` is the pooled connection used at runtime: Supabase's pooler in
 * session mode (see `sessionPoolerUrl`). Serverless functions come and go, and
 * the pooler keeps them from exhausting Postgres' connection slots. Migrations
 * use `DIRECT_URL`, which drizzle-kit needs to be a session of its own.
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
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  return url ? sessionPoolerUrl(url) : undefined;
}

/**
 * Supabase's transaction pooler URL, moved to the same pooler's session port.
 *
 * Every admin page hung for 300 seconds in production. The database showed
 * why: the admin lookup sat "active", waiting on ClientRead, inside an open
 * transaction, with the start of the query and never the rest. With prepared
 * statements off, postgres.js runs any query with parameters in two round
 * trips (describe it, then bind and execute), and the transaction pooler
 * (port 6543) lost the second half. Queries without parameters never
 * hung, which is why the health check kept answering throughout. Neither
 * plain Postgres nor PgBouncer, tried locally as a stand-in, does this, so no
 * local test saw it. docs/adr/0008-session-pooler-and-idle-connections.md.
 *
 * In session mode (port 5432, same host and credentials) a client keeps one
 * database connection for as long as it is connected, so a query in two parts
 * cannot be split across two. That costs connections, which does not matter
 * here: an instance holds one and closes it after a few idle seconds.
 *
 * Done here, rather than by changing the deployment's variable, so that the
 * URL Supabase and Vercel hand out keeps working as given.
 */
export function sessionPoolerUrl(url: string): string {
  return url.replace(/(@[^/?#]*\.pooler\.supabase\.com):6543(?=[/?#]|$)/, "$1:5432");
}

/** Seconds a quiet connection is kept before the client closes it. */
export const IDLE_TIMEOUT_SECONDS = 5;

export function clientOptions(connectionString: string, production: boolean) {
  // Prepared statements stay off on any Supabase pooler. In transaction mode
  // each statement can reach a different backend, where a statement prepared on
  // another does not exist. Session mode, which the app now uses, would allow
  // them, but a pooler URL can still arrive in transaction mode (a variable set
  // by hand, a script), and off is safe in both. Detected from the connection
  // string rather than NODE_ENV, so a local process pointed at the pooler
  // behaves the same way.
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
 * done, and a suspended process runs no timers, so the idle timeout above
 * cannot close a connection between requests. The connection would sleep with
 * the instance while the pooler dropped it, and the next request would write to
 * a dead socket. Vercel documents this and ships `attachDatabasePool` for it,
 * which does not support postgres.js; this is the same mechanism.
 *
 * (It was first written as the fix for pages hanging for 300 seconds. That
 * turned out to be the transaction pooler, above; see ADR 0008. This stays
 * because the failure it prevents is real on its own.)
 *
 * Every use re-arms one hold, handed to `waitUntil`, that outlasts the idle
 * timeout, so the client closes the connection while the instance is still
 * running. Outside Vercel nothing suspends, so there is nothing to hold, and
 * scripts are not kept running by the timer.
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
