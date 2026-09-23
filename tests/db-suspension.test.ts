import net from "node:net";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { clientOptions, keepAwakeWhileUsed } from "@/db";

/**
 * A connection must not outlive the request that used it into a suspension.
 *
 * Vercel suspends a function instance between requests, and a suspended
 * process runs no timers, so the client's idle timeout cannot close a quiet
 * connection. While the instance sleeps, the pooler drops that connection, and
 * the goodbye is lost because nothing is running to receive it. The next
 * request writes its query to a socket nobody answers, and with one connection
 * per instance, every request behind it waits too, until the platform kills the
 * instance at 300 seconds.
 *
 * This reproduces that locally. A TCP relay stands in for the pooler, and
 * "suspending" makes it go silent on every connection that is still open,
 * without closing any of them. The request context is a stand-in for Vercel's,
 * so `waitUntil` behaves as the instance does: it stays awake until the work
 * handed to it is done, and only then sleeps.
 */

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set; the database tests need a local Postgres.");
const target = new URL(url);

const IDLE_SECONDS = 1;

let relay: net.Server;
let relayPort: number;
const open = new Set<{ silence: () => void }>();

beforeAll(async () => {
  relay = net.createServer((client) => {
    const upstream = net.connect(Number(target.port || 5432), target.hostname);
    client.pipe(upstream);
    upstream.pipe(client);
    const link = {
      // Stop carrying bytes in either direction but keep both sockets open, the
      // way a connection looks from inside an instance that slept through its
      // closing.
      silence() {
        client.unpipe(upstream);
        upstream.unpipe(client);
        client.on("data", () => {});
        upstream.on("data", () => {});
      },
    };
    open.add(link);
    const forget = () => open.delete(link);
    client.on("close", forget).on("error", forget);
    upstream.on("close", forget).on("error", forget);
  });
  await new Promise<void>((r) => relay.listen(0, "127.0.0.1", r));
  relayPort = (relay.address() as net.AddressInfo).port;
});

afterAll(() => {
  relay.close();
});

/** Vercel's request context, reduced to the one method this relies on. */
const pending: Promise<unknown>[] = [];
const CONTEXT = Symbol.for("@vercel/request-context");
beforeAll(() => {
  (globalThis as Record<symbol, unknown>)[CONTEXT] = {
    get: () => ({ waitUntil: (p: Promise<unknown>) => pending.push(p) }),
  };
  process.env.VERCEL = "1";
});
afterAll(() => {
  delete (globalThis as Record<symbol, unknown>)[CONTEXT];
  delete process.env.VERCEL;
});

const clients: ReturnType<typeof postgres>[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.end({ timeout: 0 })));
});

function connect() {
  const relayed = new URL(url!);
  relayed.hostname = "127.0.0.1";
  relayed.port = String(relayPort);
  const client = postgres(relayed.toString(), {
    ...clientOptions(relayed.toString(), true),
    idle_timeout: IDLE_SECONDS,
  });
  clients.push(client);
  const db = drizzle(client);
  return keepAwakeWhileUsed(() => db, IDLE_SECONDS);
}

/** The request is over: the instance finishes what it was asked to wait for, then sleeps. */
async function suspend() {
  await Promise.all(pending.splice(0));
  for (const link of open) link.silence();
}

function answeredWithin<T>(ms: number, query: Promise<T>) {
  return Promise.race([
    query.then(() => "answered"),
    new Promise<string>((r) => setTimeout(() => r("hung"), ms)),
  ]);
}

describe("a connection across a suspension", () => {
  it("is closed before the instance sleeps, so the next request connects afresh", async () => {
    const db = connect();

    await db.execute(sql`SELECT 1`);
    await suspend();

    // One request, then a burst behind it, as when the next page load arrives
    // with its own parallel queries.
    const outcome = await answeredWithin(
      5_000,
      Promise.all([1, 2, 3].map((n) => db.execute(sql`SELECT ${n}::int`))),
    );
    expect(outcome).toBe("answered");
  }, 20_000);

  it("keeps the instance awake no longer than the idle timeout needs", async () => {
    const db = connect();
    await db.execute(sql`SELECT 1`);

    const started = Date.now();
    await Promise.all(pending.splice(0));
    const held = Date.now() - started;

    expect(held).toBeGreaterThan(IDLE_SECONDS * 1000);
    expect(held).toBeLessThan((IDLE_SECONDS + 6) * 1000);
  }, 20_000);
});
