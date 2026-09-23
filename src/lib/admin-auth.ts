import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db";
import { adminLoginTokens, adminUsers, persons } from "@/db/schema";
import { ConfigurationError } from "@/lib/config";
import { newSignInCode, normalizeSignInCode } from "@/lib/sign-in-code";

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
/**
 * Thirty days, so the administrator's own phone and laptop stay signed in.
 * Signing out ends it at once, which is what a shared device like the cart's
 * iPad calls for.
 */
const SESSION_SECONDS = 60 * 60 * 24 * 30;
/**
 * Long enough to walk to a laptop, short enough that a forwarded mail is stale.
 * Exported so the email states the same number the database enforces.
 */
export const TOKEN_MINUTES = 15;
/** Sign-in links requestable per address per hour, to stop mailbox flooding. */
const MAX_LINKS_PER_HOUR = 5;
/**
 * Wrong code entries allowed against one outstanding token.
 *
 * This, not the length of the code, is what makes a six-digit secret safe. Five
 * guesses at a million, against a code that belongs to one address and dies in
 * fifteen minutes, is not an attack worth mounting.
 */
const MAX_CODE_ATTEMPTS = 5;

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
 *
 * It holds for the six-digit code too, whose keyspace a laptop could otherwise
 * exhaust instantly: HMAC's key is `SESSION_SECRET`, which lives in the
 * environment and not in the table, so a stolen dump has nothing to grind
 * against.
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
 * Issues a sign-in link, and a short code that redeems the same row.
 *
 * Two ways in, one secret's worth of trust: whichever is used spends the row,
 * so a code cannot outlive the link it was mailed with.
 *
 * The code exists because the link assumes you can open your email on the
 * device you are signing in on, and on the cart's iPad that is precisely what
 * should not happen. It is a shared device a student uses; a personal mailbox
 * signed into it to read one link stays signed in afterwards. So the mail goes
 * to a phone and the code is typed on the iPad.
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
  return startSessionFor(claimed.person_id);
}

export type RedeemCodeResult =
  | { ok: true; identity: AdminIdentity }
  | { ok: false; error: "invalid" | "too_many" };

/**
 * Redeems a typed code and starts a session.
 *
 * The code is scoped to the address it was sent to, so a guess has to be right
 * for a specific person's single outstanding token. The `attempts` ceiling is
 * enforced inside the statement that claims the row, so a burst of parallel
 * guesses cannot slip past a count that was read a moment earlier.
 *
 * Only the newest outstanding token is considered. Asking for a second code
 * retires the first, which matches what the person expects when they give up on
 * one mail and request another.
 *
 * `invalid` covers a wrong code, an unknown address, an expired row and a spent
 * one alike. Telling them apart would tell a stranger which addresses are
 * administrators and whether a code is still live.
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

  // A wrong code still costs an attempt on the outstanding token, so a
  // malformed guess cannot be used as a free probe. An unknown address has no
  // token to charge, and looks identical from outside.
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
      const identity = await startSessionFor(claimed.person_id);
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
 * Re-checks the allowlist and issues the session cookie.
 *
 * The check happens at redemption, not only at issue: access revoked in the
 * fifteen minutes since the mail was sent must actually be revoked.
 */
async function startSessionFor(personId: string): Promise<AdminIdentity | null> {
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
