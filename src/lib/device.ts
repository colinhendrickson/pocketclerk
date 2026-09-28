import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { ConfigurationError } from "@/lib/config";
import { DEVICE_COOKIE } from "@/lib/device-cookie";

/**
 * Device pairing for the student side, so the student roster is not readable
 * by anyone who finds the URL. The setup link stores a signed cookie that every
 * student screen requires. Admin routes are unaffected.
 *
 * Optional: with no `DEVICE_CODE` set the cart is open (local dev, demo).
 * See docs/adr/0010-device-pairing.md.
 */

const COOKIE_NAME = DEVICE_COOKIE.name;

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

/** The cookie holds an HMAC of the code, so a stolen cookie does not reveal it. */
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
  store.set(COOKIE_NAME, token(), DEVICE_COOKIE.options);
}

/** Whether this device may use the cart. Always true when pairing is not configured. */
export async function isPaired(): Promise<boolean> {
  if (!pairingRequired()) return true;

  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  if (!value) return false;

  // Rotating DEVICE_CODE revokes every paired device.
  return constantTimeEquals(value, token());
}

/** The device setup link shown to admins, or null when pairing is not required. */
export function pairingUrl(appUrl: string): string | null {
  if (!pairingRequired()) return null;
  return `${appUrl.replace(/\/$/, "")}/setup?code=${encodeURIComponent(process.env.DEVICE_CODE ?? "")}`;
}
