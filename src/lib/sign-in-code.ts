import { randomInt } from "node:crypto";

/**
 * The six-digit code that stands in for a sign-in link, typed on a numeric
 * keypad. Its security comes from the surrounding limits in `admin-auth.ts`
 * (per-address, short expiry, single use, capped attempts), not its length.
 */

export const CODE_LENGTH = 6;

/**
 * A uniformly random code, zero-padded. `randomInt` avoids the modulo bias of
 * `randomBytes(n) % 1_000_000`.
 */
export function newSignInCode(): string {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

/**
 * Returns the canonical code from user input, or null if invalid. Strips spaces
 * and dashes since the code is displayed grouped.
 */
export function normalizeSignInCode(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(digits) ? digits : null;
}

/** Groups the code for readability, e.g. `483 902`. */
export function formatSignInCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}
