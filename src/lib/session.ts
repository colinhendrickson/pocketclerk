import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

/**
 * Student session: a signed, httpOnly cookie holding the open shift id.
 *
 * No JWT library and no localStorage. A JWT would be ceremony for a single
 * opaque id, and localStorage is unreadable from server components and readable
 * by any injected script. An HMAC-signed cookie is the smallest thing that
 * actually works here.
 *
 * The cookie identifies a shift, not a student. Everything a student screen is
 * allowed to do is scoped to their own open shift, so the shift id is both the
 * session and the authorization scope.
 */

const COOKIE_NAME = "pocketclerk_shift";
/** A shift is a school day at most; the cookie should not outlive it. */
const MAX_AGE_SECONDS = 60 * 60 * 12;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to at least 32 characters. See .env.example.",
    );
  }
  return value;
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

/** Verifies the signature in constant time and returns the payload, or null. */
function unsign(signed: string): string | null {
  const index = signed.lastIndexOf(".");
  if (index <= 0) return null;

  const value = signed.slice(0, index);
  const provided = Buffer.from(signed.slice(index + 1));
  const expected = Buffer.from(sign(value));

  if (provided.length !== expected.length) return null;
  return timingSafeEqual(provided, expected) ? value : null;
}

export async function setShiftSession(shiftId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, `${shiftId}.${sign(shiftId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/** The signed-in shift id, or null. Tampering yields null, never a throw. */
export async function getShiftSession(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  return raw ? unsign(raw) : null;
}

export async function clearShiftSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
