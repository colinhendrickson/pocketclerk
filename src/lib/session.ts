import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { ConfigurationError } from "@/lib/config";
import { parseCrew, serializeCrew } from "@/lib/crew";

/**
 * Student session: an HMAC-signed, httpOnly cookie holding the open shift id.
 * The shift id is both the session and the authorization scope; every student
 * action is limited to that shift.
 *
 * A second cookie holds the crew: every shift clocked in on this device, so
 * several students can work at once (src/lib/crew.ts). The shift cookie names
 * the one at the register.
 */

const COOKIE_NAME = "pocketclerk_shift";
const CREW_COOKIE_NAME = "pocketclerk_crew";
/**
 * Signed apart from the shift cookie, so a shift cookie's value (one id and a
 * signature) can never be replayed as a crew.
 */
const CREW_DOMAIN = "crew:";
/** A shift is a school day at most; the cookie should not outlive it. */
const MAX_AGE_SECONDS = 60 * 60 * 12;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new ConfigurationError(
      "SESSION_SECRET",
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

export async function setCrewSession(shiftIds: readonly string[]): Promise<void> {
  const store = await cookies();
  if (shiftIds.length === 0) {
    store.delete(CREW_COOKIE_NAME);
    return;
  }
  const payload = serializeCrew(shiftIds);
  store.set(CREW_COOKIE_NAME, `${payload}.${sign(CREW_DOMAIN + payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/**
 * Shift ids clocked in on this device, including the one at the register, so
 * a device from before crews existed still counts its own student. Ids may
 * name shifts since closed; callers keep only the open ones.
 */
export async function getCrewSession(): Promise<string[]> {
  const store = await cookies();
  const raw = store.get(CREW_COOKIE_NAME)?.value;
  const crew = raw ? parseCrew(verifiedCrewPayload(raw)) : [];
  const current = await getShiftSession();
  return current && !crew.includes(current) ? [...crew, current] : crew;
}

function verifiedCrewPayload(signed: string): string | null {
  const index = signed.lastIndexOf(".");
  if (index <= 0) return null;
  const payload = signed.slice(0, index);
  const provided = Buffer.from(signed.slice(index + 1));
  const expected = Buffer.from(sign(CREW_DOMAIN + payload));
  if (provided.length !== expected.length) return null;
  return timingSafeEqual(provided, expected) ? payload : null;
}
