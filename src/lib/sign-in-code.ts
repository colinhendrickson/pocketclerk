import { randomInt } from "node:crypto";

/**
 * The short code that stands in for a sign-in link.
 *
 * Six digits, because the person typing it is standing at an iPad with a
 * numeric keypad and a phone in the other hand. Letters would double the
 * keyspace and triple the transcription errors: `l` against `1`, `O` against
 * `0`, and a shift key to find on a touch keyboard.
 *
 * Six digits is only defensible because of what surrounds it. A code belongs to
 * one address, lives fifteen minutes, is spent on first use, and is refused
 * after five wrong tries. That bounds an attacker to a handful of guesses at a
 * million, not to the keyspace itself. Length is the wrong dial to turn here;
 * attempts is the right one.
 *
 * Pure, so it can be tested without a database. See `admin-auth.ts` for the
 * part that stores and redeems it.
 */

export const CODE_LENGTH = 6;

/**
 * A uniformly random code.
 *
 * `randomInt` rejects biased samples rather than taking a modulus, which is the
 * standard way this gets subtly wrong: `randomBytes(4) % 1_000_000` favours low
 * codes slightly, and a predictable bias in a six-digit secret is exactly the
 * kind of edge worth not giving away.
 *
 * Leading zeros are kept. A code is a string of digits, not a number, and
 * `"004821"` is as valid as any other.
 */
export function newSignInCode(): string {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

/**
 * Accepts what a person actually types and returns the canonical code, or null
 * if it could never be one.
 *
 * Spaces and dashes are stripped because the code is *shown* grouped, and
 * someone copying it will reasonably copy the spaces too. Refusing their own
 * formatting back at them would be a gratuitous failure.
 */
export function normalizeSignInCode(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(digits) ? digits : null;
}

/** Grouped for reading aloud and for copying off a phone screen: `483 902`. */
export function formatSignInCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}
