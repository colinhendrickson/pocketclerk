import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { and, eq, gt, sql } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db";
import { adminLoginTokens, adminUsers, persons } from "@/db/schema";
import { ConfigurationError } from "@/lib/config";
import { newSignInCode, normalizeSignInCode } from "@/lib/sign-in-code";

/**
 * Administrator sign-in by emailed single-use link or code; no passwords.
 * Email proves identity; a row in `admin_users` grants admin access.
 * See docs/adr/0007-self-hosted-sign-in-links.md.
 */

const COOKIE_NAME = "pocketclerk_admin";
/** Long-lived for personal devices; sign-out ends it immediately on shared ones. */
const SESSION_SECONDS = 60 * 60 * 24 * 30;
/** Token lifetime. Exported so the email states the same value the database enforces. */
export const TOKEN_MINUTES = 15;
/** Sign-in links requestable per address per hour, to stop mailbox flooding. */
const MAX_LINKS_PER_HOUR = 5;
/**
 * Wrong code entries allowed per outstanding token. This cap, together with
 * per-address scoping and the short expiry, is what makes a six-digit code safe.
 */
const MAX_CODE_ATTEMPTS = 5;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    // Typed so callers can report a missing variable instead of a blank 500.
    throw new ConfigurationError(
      "SESSION_SECRET",
      "SESSION_SECRET must be at least 32 characters. See .env.example.",
    );
  }
  return value;
}

/**
 * Hashes tokens and codes with HMAC-SHA256 keyed by `SESSION_SECRET`.
 *
 * A slow password hash is unnecessary: tokens are 32 random bytes, and the key
 * lives in the environment rather than the database, so a stolen dump cannot be
 * brute-forced even for the small six-digit code keyspace. HMAC is also
 * deterministic, which allows lookup by hash.
 */
function hashToken(token: string): string {
  return createHmac("sha256", secret()).update(token).digest("hex");
}

export interface AdminIdentity {
  personId: string;
  name: string;
  email: string;
}

export type RequestLinkResult =
  | { ok: true; token: string; code: string; identity: AdminIdentity }
  | { ok: false; error: "not_allowed" | "rate_limited" };

/**
 * Issues a sign-in link and a short code that redeem the same row; using either
 * spends it. The code lets an admin sign in on a shared device without opening
 * their mailbox there.
 *
 * Callers must not distinguish `not_allowed` from success in the UI, so the
 * form cannot be used to enumerate administrators.
 */
export async function requestSignInLink(
  email: string,
): Promise<RequestLinkResult> {
  const normalized = email.trim().toLowerCase();

  const [row] = await db
    .select({ personId: persons.id, name: persons.name, email: persons.email })
    .from(adminUsers)
    .innerJoin(persons, eq(persons.id, adminUsers.personId))
    .where(sql`lower(${persons.email}) = ${normalized}`)
    .limit(1);

  if (!row?.email) return { ok: false, error: "not_allowed" };

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(adminLoginTokens)
    .where(
      and(
        eq(adminLoginTokens.personId, row.personId),
        gt(adminLoginTokens.createdAt, new Date(Date.now() - 60 * 60_000)),
      ),
    );

  if (count >= MAX_LINKS_PER_HOUR) return { ok: false, error: "rate_limited" };

  const token = randomBytes(32).toString("base64url");
  const code = newSignInCode();
  await db.insert(adminLoginTokens).values({
    personId: row.personId,
    tokenHash: hashToken(token),
    codeHash: hashToken(code),
    expiresAt: new Date(Date.now() + TOKEN_MINUTES * 60_000),
  });

  return {
    ok: true,
    token,
    code,
    identity: { personId: row.personId, name: row.name, email: row.email },
  };
}

/**
 * Redeems a link and starts a session. The token is claimed atomically
 * (`used_at IS NULL` in the UPDATE predicate), so concurrent clicks yield
 * exactly one success.
 */
export async function redeemSignInLink(token: string): Promise<AdminIdentity | null> {
  const [claimed] = await db.execute<{ person_id: string }>(sql`
    UPDATE admin_login_tokens
    SET used_at = now()
    WHERE token_hash = ${hashToken(token)}
      AND used_at IS NULL
      AND expires_at > now()
    RETURNING person_id
  `);

  if (!claimed) return null;
  return startAdminSession(claimed.person_id);
}

export type RedeemCodeResult =
  | { ok: true; identity: AdminIdentity }
  | { ok: false; error: "invalid" | "too_many" };

/**
 * Redeems a typed code and starts a session.
 *
 * Only the address's newest outstanding token is considered, so requesting a
 * new code retires the old one. The `attempts` cap is checked inside the
 * claiming UPDATE, so parallel guesses cannot race past it. `invalid` covers
 * wrong, unknown, expired, and spent alike to avoid leaking which addresses are
 * administrators or whether a code is live.
 */
export async function redeemSignInCode(
  email: string,
  code: string,
): Promise<RedeemCodeResult> {
  const normalizedCode = normalizeSignInCode(code);
  const normalizedEmail = email.trim().toLowerCase();

  const [row] = await db
    .select({ personId: persons.id })
    .from(adminUsers)
    .innerJoin(persons, eq(persons.id, adminUsers.personId))
    .where(sql`lower(${persons.email}) = ${normalizedEmail}`)
    .limit(1);

  // Any failed guess, including a malformed one, costs an attempt below.
  if (!row) return { ok: false, error: "invalid" };

  if (normalizedCode) {
    const [claimed] = await db.execute<{ person_id: string }>(sql`
      UPDATE admin_login_tokens
      SET used_at = now()
      WHERE id = (
        SELECT id FROM admin_login_tokens
        WHERE person_id = ${row.personId}
          AND used_at IS NULL
          AND expires_at > now()
        ORDER BY created_at DESC
        LIMIT 1
      )
        AND used_at IS NULL
        AND code_hash = ${hashToken(normalizedCode)}
        AND attempts < ${MAX_CODE_ATTEMPTS}
      RETURNING person_id
    `);

    if (claimed) {
      const identity = await startAdminSession(claimed.person_id);
      return identity
        ? { ok: true, identity }
        : { ok: false, error: "invalid" };
    }
  }

  const [spent] = await db.execute<{ attempts: number }>(sql`
    UPDATE admin_login_tokens
    SET attempts = attempts + 1
    WHERE id = (
      SELECT id FROM admin_login_tokens
      WHERE person_id = ${row.personId}
        AND used_at IS NULL
        AND expires_at > now()
      ORDER BY created_at DESC
      LIMIT 1
    )
    RETURNING attempts
  `);

  return spent && spent.attempts >= MAX_CODE_ATTEMPTS
    ? { ok: false, error: "too_many" }
    : { ok: false, error: "invalid" };
}

/**
 * Re-checks the allowlist and issues the session cookie. Checking at
 * redemption honors access revoked after the link was sent.
 */
export async function startAdminSession(personId: string): Promise<AdminIdentity | null> {
  const [person] = await db
    .select({ id: persons.id, name: persons.name, email: persons.email })
    .from(persons)
    .innerJoin(adminUsers, eq(adminUsers.personId, persons.id))
    .where(eq(persons.id, personId))
    .limit(1);

  if (!person?.email) return null;

  await setAdminSession(person.id);
  return { personId: person.id, name: person.name, email: person.email };
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

async function setAdminSession(personId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, `${personId}.${sign(personId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function clearAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/**
 * The signed-in administrator, or null. Verifies the cookie signature in
 * constant time and re-reads the allowlist so revocation takes effect on the
 * next request.
 */
export async function getAdmin(): Promise<AdminIdentity | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;

  const index = raw.lastIndexOf(".");
  if (index <= 0) return null;

  const personId = raw.slice(0, index);
  const provided = Buffer.from(raw.slice(index + 1));
  const expected = Buffer.from(sign(personId));
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  const [person] = await db
    .select({ id: persons.id, name: persons.name, email: persons.email })
    .from(persons)
    .innerJoin(adminUsers, eq(adminUsers.personId, persons.id))
    .where(eq(persons.id, personId))
    .limit(1);

  return person?.email
    ? { personId: person.id, name: person.name, email: person.email }
    : null;
}
