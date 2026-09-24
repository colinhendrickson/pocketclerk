import { afterEach, describe, expect, it } from "vitest";

import { getEmailSender } from "@/providers/email";

/**
 * The demo never sends real email: anyone can type any address into it, so a
 * key left in its settings must not turn it into a way to mail strangers.
 */

const saved = { mode: process.env.NEXT_PUBLIC_SITE_MODE, key: process.env.RESEND_API_KEY };

afterEach(() => {
  for (const [name, value] of [
    ["NEXT_PUBLIC_SITE_MODE", saved.mode],
    ["RESEND_API_KEY", saved.key],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("getEmailSender", () => {
  it("sends real email on a school's copy with a key", () => {
    delete process.env.NEXT_PUBLIC_SITE_MODE;
    process.env.RESEND_API_KEY = "re_test_key";
    expect(getEmailSender().name).toBe("resend");
  });

  it("only logs on the demo, even with a key", () => {
    process.env.NEXT_PUBLIC_SITE_MODE = "demo";
    process.env.RESEND_API_KEY = "re_test_key";
    expect(getEmailSender().name).toBe("console");
  });
});
