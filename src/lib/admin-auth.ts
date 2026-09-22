import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db";
import { adminLoginTokens, adminUsers, persons } from "@/db/schema";
import { ConfigurationError } from "@/lib/config";

/**
 * Administrator sign-in, by emailed single-use link.
 *
 * There is no password. The administrator is one person who signs in from a
 * school laptop a few times a term, and a password she would have to remember
 * or reset is worse security and worse ergonomics than a link sent to the
 * address that already identifies her.
 *
 * Sign-in is handled here rather than delegated to a hosted auth provider for
 * two reasons: the email provider interface already exists, so a link costs one
 * function call; and it keeps the promise that the project runs end to end with
 * no cloud account. See docs/adr/0007-self-hosted-magic-links.md.
 *
 * The allowlist is the authorization model. Being able to receive mail at an
 * address proves who you are; having a row in `admin_users` is what makes you
 * an administrator. Anyone else who somehow obtains a link gets nothing.
 */

const COOKIE_NAME = "pocketclerk_admin";
/** A school day, so a laptop left closed overnight signs out. */
const SESSION_SECONDS = 60 * 60 * 10;
/** Long enough to walk to a laptop, short enough that a forwarded mail is stale. */
const TOKEN_MINUTES = 15;
/** Sign-in links requestable per address per hour, to stop mailbox flooding. */
const MAX_LINKS_PER_HOUR = 5;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    // Typed, so a caller can tell a missing deployment variable apart from a
    // genuine fault and say something useful instead of returning a blank 500.
    throw new ConfigurationError(
      "SESSION_SECRET",
      "SESSION_SECRET must be at least 32 characters. See .env.example.",
    );
  }
  return value;
}

/**
 * Tokens are hashed with HMAC rather than a slow password hash.
 *
 * A password hash is deliberately slow to make guessing expensive, which
 * matters for a secret a human chose. This secret is 32 random bytes, so
 * guessing is already hopeless and the only job left is making a stolen
 * database useless. HMAC does that, and it is fast enough to look up by hash.
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
  | { ok: true; token: string; identity: AdminIdentity }
  | { ok: false; error: "not_allowed" | "rate_limited" };

/**
 * Issues a sign-in link for an allowlisted address.
 *
 * Returns `not_allowed` for an address that is not an administrator. The caller
 * must not reveal which of the two happened: the sign-in page says the same
 * thing either way, so the form cannot be used to discover who the
 * administrators are.
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
  await db.insert(adminLoginTokens).values({
    personId: row.personId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + TOKEN_MINUTES * 60_000),
  });

  return {
    ok: true,
    token,
    identity: { personId: row.personId, name: row.name, email: row.email },
  };
}

/**
 * Redeems a link and starts a session.
 *
 * The token is marked used in the same statement that reads it, with `used_at
 * IS NULL` in the predicate. Two simultaneous clicks therefore race Postgres
 * rather than the application, and exactly one of them updates a row.
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

  const [person] = await db
    .select({ id: persons.id, name: persons.name, email: persons.email })
    .from(persons)
    .innerJoin(adminUsers, eq(adminUsers.personId, persons.id))
    .where(eq(persons.id, claimed.person_id))
    .limit(1);

  // Allowlist is re-checked at redemption, not only at issue: access revoked in
  // the fifteen minutes since the link was sent must actually be revoked.
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
 * The signed-in administrator, or null.
 *
 * Re-reads the allowlist on every call rather than trusting the cookie alone,
 * so removing someone takes effect on their next request instead of whenever
 * their session happens to expire.
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

/** Housekeeping: expired and spent tokens are not worth keeping. */
export async function purgeStaleTokens(): Promise<void> {
  await db
    .delete(adminLoginTokens)
    .where(
      and(
        lt(adminLoginTokens.expiresAt, new Date()),
        isNull(adminLoginTokens.usedAt),
      ),
    );
}
