import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/** Hand-rolled because `promisify(scrypt)` types drop the options overload. */
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
 * Student PIN hashing and lockout checks.
 *
 * Hashing a four-digit PIN cannot resist brute force; it only keeps a leaked
 * table from exposing PINs in plaintext. The per-student lockout is what stops
 * online guessing. scrypt is used because it ships with Node (no native deps).
 */

const SCRYPT_KEYLEN = 64;
/** Costly on purpose; sign-ins are infrequent. */
const SCRYPT_COST = 2 ** 15;
/** scrypt needs ~`128 * N * r` bytes, just over Node's 32 MB default at this cost. */
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
 * Verifies a PIN against a stored hash in constant time. A malformed hash
 * returns false (deny) rather than throwing.
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

/** Whole minutes remaining on a lockout, for the message shown to the student. */
export function lockoutMinutesRemaining(
  lockedUntil: Date,
  now: Date = new Date(),
): number {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 60_000));
}
