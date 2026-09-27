import { sql } from "drizzle-orm";

import { db } from "@/db";
import { LOCKOUT_MINUTES, MAX_FAILED_ATTEMPTS } from "@/lib/auth";

/**
 * The PIN lockout, counted by the database.
 *
 * The first version read `failed_attempts`, added one in JavaScript, and wrote
 * the result back. Twenty wrong guesses sent at once all read the same count
 * and all wrote the same count plus one, so the lockout never engaged: the
 * limit on guessing a four-digit PIN held only for someone polite enough to
 * guess one at a time. It is the same check-then-act race the schema's
 * constraints exist to prevent everywhere else, applied to a counter.
 *
 * Here the increment, the decision, and the lock happen in one UPDATE. Postgres
 * serializes concurrent updates to the same row and re-checks the WHERE clause
 * against the row each one finally sees, so no two guesses can count as one.
 */

export type FailedPinResult =
  | { locked: false; attemptsRemaining: number }
  | { locked: true; lockedUntil: Date };

/**
 * Records one wrong PIN and reports whether the student is now locked out.
 *
 * Every SET expression reads the row as it was before this statement, which is
 * what lets one statement both reset the counter and set the lock when the
 * limit is reached. The WHERE clause refuses to count against a student who is
 * already locked, so guesses that arrive during a lockout neither extend it nor
 * leave a half-spent counter behind for when it lifts.
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
 * Clears the counter after a correct PIN, but only if the student is not
 * locked out at this moment.
 *
 * A correct guess can be in flight while a burst of wrong ones locks the
 * student. Checking the lock once at the start of the request would let that
 * guess through anyway; checking it in the statement that accepts the PIN does
 * not. Returns false when the lock won.
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
