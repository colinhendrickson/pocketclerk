import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { ConfigurationError } from "@/lib/config";

/**
 * Device pairing for the student side.
 *
 * The cart screens are a kiosk, not a website. They list the first names of
 * children and accept a four-digit PIN, and neither of those should be reachable
 * by anyone who happens to find the address. Rate limiting makes guessing a PIN
 * impractical, but it does nothing about the roster being readable, and a list
 * of pupils' names is the part that actually matters.
 *
 * So the cart is paired once to a device. Visiting the setup link stores a
 * signed cookie on that iPad; every student screen requires it. Without it the
 * site says only that the device is not set up, revealing no names, no menu and
 * no school detail beyond what the branding already shows.
 *
 * The administrator side is unaffected. It is gated by an emailed link to an
 * allowlisted address, which is a stronger check than this one and works from
 * any laptop.
 *
 * Pairing is optional by design: with no `DEVICE_CODE` set the cart is open,
 * which keeps local development and the public demo working unchanged. A real
 * deployment sets it.
 */

const COOKIE_NAME = "pocketclerk_device";
/** A school year. Re-pairing every term would be worse than the risk it avoids. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** True when this deployment requires devices to be paired. */
export function pairingRequired(): boolean {
  return (process.env.DEVICE_CODE ?? "").length > 0;
}

function expectedCode(): string {
  const code = process.env.DEVICE_CODE;
  if (!code) {
    throw new ConfigurationError("DEVICE_CODE", "DEVICE_CODE is not set.");
  }
  return code;
}

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new ConfigurationError(
      "SESSION_SECRET",
      "SESSION_SECRET must be at least 32 characters. See .env.example.",
    );
  }
  return value;
}

/**
 * The cookie holds a signature of the code rather than the code itself, so a
 * stolen cookie cannot be read back into the value someone would type.
 */
function token(): string {
  return createHmac("sha256", secret()).update(expectedCode()).digest("base64url");
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Does the supplied setup code match this deployment's? */
export function codeMatches(candidate: string): boolean {
  return constantTimeEquals(candidate.trim(), expectedCode());
}

export async function pairDevice(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, token(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function unpairDevice(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/**
 * May this device use the cart?
 *
 * Always true when pairing is not configured, so nothing changes for local
 * development or the demo.
 */
export async function isPaired(): Promise<boolean> {
  if (!pairingRequired()) return true;

  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  if (!value) return false;

  // Rotating DEVICE_CODE invalidates every paired device, because the signature
  // is over the code. That is the intended way to revoke a lost iPad.
  return constantTimeEquals(value, token());
}
