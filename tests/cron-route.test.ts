import { afterAll, afterEach, describe, expect, it } from "vitest";

import { getClient } from "@/db";
import { POST } from "@/app/api/receipt-jobs/email/route";

/**
 * Who may trigger the receipt sweep.
 *
 * The sweep sends mail from the deployment's own account, so an open endpoint
 * on a real deployment is a way for a stranger to spend it. These pin down the
 * three answers: refused when a real deployment has no secret, refused with the
 * wrong secret, allowed with the right one.
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

function call(authorization?: string) {
  return POST(
    new Request("http://localhost/api/receipt-jobs/email", {
      method: "POST",
      headers: authorization ? { authorization } : {},
    }),
  );
}

describe("the receipt sweep", () => {
  it("refuses everyone on a real deployment with no secret", async () => {
    env.NODE_ENV = "production";
    env.CRON_SECRET = "";
    const response = await call();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "CRON_SECRET is not configured" });
  });

  it("refuses a wrong secret", async () => {
    env.CRON_SECRET = "the-real-secret-value";
    expect((await call("Bearer a-guess")).status).toBe(401);
    expect((await call()).status).toBe(401);
    // Same length as the real header, differing only at the end.
    expect((await call("Bearer the-real-secret-valuX")).status).toBe(401);
  });

  it("runs for the right secret", async () => {
    env.CRON_SECRET = "the-real-secret-value";
    const response = await call("Bearer the-real-secret-value");
    expect(response.status).toBe(200);
  });

  it("stays open in development, where there is nothing to protect", async () => {
    env.NODE_ENV = "development";
    env.CRON_SECRET = "";
    expect((await call()).status).toBe(200);
  });
});
