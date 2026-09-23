/**
 * Does the database connection hang the way production pages do?
 *
 * Runs the app's production connection settings against a real pooler, in the
 * pattern that hung on the first deployment: a burst of concurrent queries,
 * then pauses long enough for the idle timeout to close the connection, then
 * more queries. Every step has a watchdog, so a hang is reported as a hang
 * instead of freezing the script.
 *
 * Usage (PowerShell):
 *   $env:PROBE_URL = "<Supabase Transaction pooler string, port 6543>"
 *   pnpm exec tsx scripts/probe-pooler.ts
 *   Remove-Item Env:\PROBE_URL
 *
 * Prints the host only, never the password.
 */
import postgres from "postgres";

import { clientOptions } from "../src/db";

const url = process.env.PROBE_URL;
if (!url) {
  console.error("Set PROBE_URL to the pooled connection string first.");
  process.exit(1);
}

const started = Date.now();
const t = () => `+${((Date.now() - started) / 1000).toFixed(1)}s`.padEnd(8);
console.log(`host: ${new URL(url).host}`);

// The app's production settings, from the same function the app uses.
const sql = postgres(url, {
  ...clientOptions(url, true),
  onclose: (id) => console.log(`${t()} (connection ${id} closed)`),
});

const WATCHDOG_MS = 30_000;
async function step(label: string, run: () => Promise<unknown>): Promise<boolean> {
  const t0 = Date.now();
  const outcome = await Promise.race([
    run().then(
      () => `ok in ${Date.now() - t0} ms`,
      (e: Error) => `ERROR after ${Date.now() - t0} ms: ${e.message}`,
    ),
    new Promise<string>((r) => setTimeout(() => r(`HUNG: no reply in ${WATCHDOG_MS / 1000}s`), WATCHDOG_MS)),
  ]);
  console.log(`${t()} ${label.padEnd(44)} ${outcome}`);
  return !outcome.startsWith("HUNG");
}

const one = () => sql`SELECT 1 AS ok`;
const burst = () => Promise.all(Array.from({ length: 8 }, (_, i) => sql`SELECT ${i}::int AS n, pg_sleep(0.05)`));
const pause = (s: number) => {
  console.log(`${t()} ...idle for ${s}s`);
  return new Promise((r) => setTimeout(r, s * 1000));
};

async function main(): Promise<void> {
  let healthy = true;
  healthy = (await step("1. first query (cold connect)", one)) && healthy;
  healthy = (await step("2. second query (warm)", one)) && healthy;
  healthy = (await step("3. burst of 8 at once (rapid clicking)", burst)) && healthy;
  await pause(25);
  healthy = (await step("4. after 25s idle (past idle_timeout)", one)) && healthy;
  healthy = (await step("5. burst of 8 after reconnect", burst)) && healthy;
  await pause(90);
  healthy = (await step("6. after 90s idle", one)) && healthy;
  healthy = (await step("7. final burst of 8", burst)) && healthy;

  console.log(healthy ? "\nNo hang reproduced." : "\nReproduced: a step hung. Paste this whole output back.");
  await Promise.race([sql.end({ timeout: 5 }), new Promise((r) => setTimeout(r, 6000))]);
  process.exit(healthy ? 0 : 2);
}

void main();
