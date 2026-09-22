import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db, getClient } from "@/db";
import { redeemSignInCode, requestSignInLink } from "@/lib/admin-auth";

/**
 * The guessing budget on a six-digit sign-in code.
 *
 * Six digits is a small secret, and everything that makes it safe lives here
 * rather than in the code itself: it belongs to one address, it dies in fifteen
 * minutes, and it is refused after five wrong tries. If the attempt ceiling ever
 * stops being enforced, the whole scheme quietly becomes a million guesses at a
 * password, so it is worth proving against a real database.
 *
 * The success path is not exercised here. Redeeming sets a session cookie, and
 * `cookies()` only exists inside a request; that path is covered by signing in
 * for real. What these tests protect is everything that must *fail*.
 */

const EMAIL = "sign-in-test@example.invalid";
let personId: string;

async function makeAdmin(): Promise<void> {
  const [person] = await db.execute<{ id: string }>(
    sql`INSERT INTO persons (name, email) VALUES ('Sign In Test', ${EMAIL})
        RETURNING id`,
  );
  personId = person.id;
  await db.execute(sql`INSERT INTO admin_users (person_id) VALUES (${personId})`);
}

async function removeAdmin(): Promise<void> {
  await db.execute(sql`DELETE FROM admin_login_tokens WHERE person_id = ${personId}`);
  await db.execute(sql`DELETE FROM admin_users WHERE person_id = ${personId}`);
  await db.execute(sql`DELETE FROM persons WHERE id = ${personId}`);
}

async function attemptsOnNewestToken(): Promise<number> {
  const [row] = await db.execute<{ attempts: number }>(
    sql`SELECT attempts FROM admin_login_tokens
        WHERE person_id = ${personId}
        ORDER BY created_at DESC LIMIT 1`,
  );
  return row.attempts;
}

/** Any code that is not the issued one. */
function wrongCode(issued: string): string {
  return issued === "000000" ? "111111" : "000000";
}

beforeEach(async () => {
  if (personId) await removeAdmin();
  await makeAdmin();
});

afterAll(async () => {
  await removeAdmin();
  await getClient().end();
});

describe("requesting a code", () => {
  it("issues a six-digit code alongside the link", async () => {
    const result = await requestSignInLink(EMAIL);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.code).toMatch(/^\d{6}$/);
    expect(result.token).not.toBe(result.code);
  });

  it("refuses an address that is not an administrator", async () => {
    const result = await requestSignInLink("stranger@example.invalid");
    expect(result).toEqual({ ok: false, error: "not_allowed" });
  });
});

describe("redeeming a code", () => {
  it("refuses a wrong code and spends an attempt", async () => {
    const issued = await requestSignInLink(EMAIL);
    if (!issued.ok) throw new Error("expected a code");

    const result = await redeemSignInCode(EMAIL, wrongCode(issued.code));
    expect(result).toEqual({ ok: false, error: "invalid" });
    expect(await attemptsOnNewestToken()).toBe(1);
  });

  it("refuses a malformed code without leaving it free", async () => {
    // Otherwise "12345" is an unlimited probe: rejected before the database,
    // costing nothing, while a real guess costs an attempt.
    await requestSignInLink(EMAIL);

    const result = await redeemSignInCode(EMAIL, "not-a-code");
    expect(result).toEqual({ ok: false, error: "invalid" });
    expect(await attemptsOnNewestToken()).toBe(1);
  });

  it("stops accepting the correct code after five wrong ones", async () => {
    const issued = await requestSignInLink(EMAIL);
    if (!issued.ok) throw new Error("expected a code");
    const wrong = wrongCode(issued.code);

    for (let i = 1; i <= 4; i += 1) {
      expect(await redeemSignInCode(EMAIL, wrong)).toEqual({
        ok: false,
        error: "invalid",
      });
    }

    expect(await redeemSignInCode(EMAIL, wrong)).toEqual({
      ok: false,
      error: "too_many",
    });

    // The real code, now worthless. This is the assertion that matters: the
    // ceiling has to bind the right answer too, or five wrong guesses buy an
    // attacker nothing but a sixth.
    expect(await redeemSignInCode(EMAIL, issued.code)).toEqual({
      ok: false,
      error: "too_many",
    });
  });

  it("refuses an expired code", async () => {
    const issued = await requestSignInLink(EMAIL);
    if (!issued.ok) throw new Error("expected a code");
    await db.execute(
      sql`UPDATE admin_login_tokens SET expires_at = now() - interval '1 minute'
          WHERE person_id = ${personId}`,
    );

    expect(await redeemSignInCode(EMAIL, issued.code)).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("refuses a code that has already been spent", async () => {
    const issued = await requestSignInLink(EMAIL);
    if (!issued.ok) throw new Error("expected a code");
    await db.execute(
      sql`UPDATE admin_login_tokens SET used_at = now() WHERE person_id = ${personId}`,
    );

    expect(await redeemSignInCode(EMAIL, issued.code)).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("retires the previous code when a new one is requested", async () => {
    const first = await requestSignInLink(EMAIL);
    const second = await requestSignInLink(EMAIL);
    if (!first.ok || !second.ok) throw new Error("expected two codes");

    // Only the newest outstanding token is considered, which is what someone
    // expects after giving up on one email and asking for another.
    expect(await redeemSignInCode(EMAIL, first.code)).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("gives an unknown address the same answer as a wrong code", async () => {
    expect(await redeemSignInCode("stranger@example.invalid", "123456")).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("does not let one address spend another's attempts", async () => {
    const issued = await requestSignInLink(EMAIL);
    if (!issued.ok) throw new Error("expected a code");

    await redeemSignInCode("stranger@example.invalid", issued.code);
    expect(await attemptsOnNewestToken()).toBe(0);
  });
});
