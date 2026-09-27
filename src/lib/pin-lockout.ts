import { sql } from "drizzle-orm";

import { db } from "@/db";
import { LOCKOUT_MINUTES, MAX_FAILED_ATTEMPTS } from "@/lib/auth";

/**
 * PIN lockout, counted by the database.
 *
 * Increment, threshold check, and lock happen in a single UPDATE rather than
 * read-modify-write in JS, which would let concurrent guesses read the same
 * count. Postgres serializes updates to the row and re-evaluates WHERE against
 * the latest version, so every guess is counted.
 * See docs/adr/0004-invariants-in-the-database.md.
 */

export type FailedPinResult =
  | { locked: false; attemptsRemaining: number }
  | { locked: true; lockedUntil: Date };

/**
 * Records one wrong PIN and reports whether the student is now locked out.
 *
 * SET expressions see the pre-update row, so one statement can both reset the
 * counter and set the lock at the limit. The WHERE clause skips students
 * already locked, so guesses during a lockout neither extend it nor leave a
 * partial count behind.
 */
export async function recordFailedPin(studentId: string): Promise<FailedPinResult> {
  const [row] = await db.execute<{ failed_attempts: number; locked_until: Date | string | null }>(sql`
    UPDATE students
    SET
      failed_attempts = CASE
        WHEN failed_attempts + 1 >= ${MAX_FAILED_ATTEMPTS} THEN 0
        ELSE failed_attempts + 1
      END,
      locked_until = CASE
        WHEN failed_attempts + 1 >= ${MAX_FAILED_ATTEMPTS}
          THEN now() + make_interval(mins => ${LOCKOUT_MINUTES})
        ELSE locked_until
      END
    WHERE id = ${studentId}
      AND (locked_until IS NULL OR locked_until <= now())
    RETURNING failed_attempts, locked_until
  `);

  if (!row) {
    // Another guess locked this student between our PIN check and now.
    const [current] = await db.execute<{ locked_until: Date | string | null }>(sql`
      SELECT locked_until FROM students WHERE id = ${studentId}
    `);
    return {
      locked: true,
      lockedUntil: new Date(current?.locked_until ?? Date.now() + LOCKOUT_MINUTES * 60_000),
    };
  }

  const lockedUntil = row.locked_until ? new Date(row.locked_until) : null;
  if (lockedUntil && lockedUntil.getTime() > Date.now()) {
    return { locked: true, lockedUntil };
  }
  return { locked: false, attemptsRemaining: MAX_FAILED_ATTEMPTS - row.failed_attempts };
}

/**
 * Clears the counter after a correct PIN unless the student is locked out.
 * The lock is checked in the accepting statement itself, so a correct guess
 * racing a lockout-triggering burst is refused. Returns false if locked.
 */
export async function acceptCorrectPin(studentId: string): Promise<boolean> {
  const rows = await db.execute<{ id: string }>(sql`
    UPDATE students
    SET failed_attempts = 0, locked_until = NULL
    WHERE id = ${studentId}
      AND (locked_until IS NULL OR locked_until <= now())
    RETURNING id
  `);
  return rows.length > 0;
}
