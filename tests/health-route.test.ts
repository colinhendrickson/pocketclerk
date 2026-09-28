import { afterAll, afterEach, describe, expect, it } from "vitest";

import { getClient } from "@/db";
import { GET } from "@/app/api/health/route";

/**
 * /api/health is public. Readiness is for anyone; how a deployment is set up
 * (pairing, email, cron) is only for someone holding CRON_SECRET.
 */

const env = process.env as Record<string, string | undefined>;
const saved = { NODE_ENV: env.NODE_ENV, CRON_SECRET: env.CRON_SECRET };

afterEach(() => {
  env.NODE_ENV = saved.NODE_ENV;
  env.CRON_SECRET = saved.CRON_SECRET;
});

afterAll(async () => {
  await getClient().end();
});

async function health(authorization?: string) {
  const response = await GET(
    new Request("http://localhost/api/health", { headers: authorization ? { authorization } : {} }),
  );
  return (await response.json()) as Record<string, unknown>;
}

describe("/api/health", () => {
  it("tells anyone whether the deployment is ready, and nothing about its setup", async () => {
    env.NODE_ENV = "production";
    env.CRON_SECRET = "the-real-secret-value";
    const body = await health();
    expect(body).toHaveProperty("ready");
    expect(body).toHaveProperty("database");
    expect(JSON.stringify(body)).not.toMatch(/devicePairing|email|receiptSweep/);
    expect(JSON.stringify(await health("Bearer a-guess"))).not.toMatch(/devicePairing/);
  });

  it("shows the setup to someone holding CRON_SECRET", async () => {
    env.NODE_ENV = "production";
    env.CRON_SECRET = "the-real-secret-value";
    const body = await health("Bearer the-real-secret-value");
    expect(body.setup).toHaveProperty("devicePairing");
  });

  it("shows the setup in development", async () => {
    env.NODE_ENV = "development";
    expect((await health()).setup).toHaveProperty("timeZone");
  });
});
