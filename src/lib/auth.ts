import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Hand-rolled rather than `promisify(scrypt)`: promisify resolves to the
 * three-argument overload and drops the options parameter, so passing `N` and
 * `maxmem` would not typecheck.
 */
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

/**
 * PIN hashing and student sessions.
 *
 * Students sign in by tapping their name and entering a four-digit PIN. There
 * are no accounts: emails, passwords and reset flows are friction this audience
 * cannot absorb, and the cart is a supervised classroom device, not the open
 * internet.
 *
 * The hash is not pretending to make a four-digit PIN brute-force resistant;
 * nothing can. It protects the *database dump* case, so that a leaked table
 * does not hand out every student's PIN in plaintext. Rate limiting, stored on
 * the student row, is what actually stops guessing.
 *
 * scrypt comes from Node's standard library, so there is no native module to
 * fail to install on a contributor's machine or in CI.
 */

const SCRYPT_KEYLEN = 64;
/** Deliberately costly. A sign-in happens a handful of times per shift. */
const SCRYPT_COST = 2 ** 15;
/**
 * scrypt needs roughly `128 * N * r` bytes, which at this cost is just over
 * Node's 32 MB default and fails with ERR_CRYPTO_INVALID_SCRYPT_PARAMS unless
 * the ceiling is raised explicitly.
 */
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

/** Hashes a PIN as `scrypt$<salt hex>$<derived key hex>`. */
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(pin, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_COST,
    maxmem: SCRYPT_MAXMEM,
  });
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

/**
 * Verifies a PIN against a stored hash in constant time.
 *
 * Returns false rather than throwing on a malformed hash: a corrupted row
 * should deny access, never crash the sign-in screen in front of a student.
 */
export async function verifyPin(storedHash: string, pin: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = storedHash.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;

  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(keyHex, "hex");
    const actual = await scryptAsync(pin, salt, expected.length, {
      N: SCRYPT_COST,
      maxmem: SCRYPT_MAXMEM,
    });
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/** True when the student is currently locked out of sign-in. */
export function isLockedOut(lockedUntil: Date | null, now: Date = new Date()): boolean {
  return lockedUntil !== null && lockedUntil.getTime() > now.getTime();
}

/** How long a lockout should last once the attempt limit is reached. */
export function lockoutUntil(now: Date = new Date()): Date {
  return new Date(now.getTime() + LOCKOUT_MINUTES * 60_000);
}

/** Whole minutes remaining on a lockout, for the message shown to the student. */
export function lockoutMinutesRemaining(
  lockedUntil: Date,
  now: Date = new Date(),
): number {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 60_000));
}
