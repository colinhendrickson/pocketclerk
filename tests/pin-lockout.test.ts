import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db, getClient } from "@/db";
import { hashPin, MAX_FAILED_ATTEMPTS } from "@/lib/auth";
import { acceptCorrectPin, recordFailedPin } from "@/lib/pin-lockout";

/**
 * The PIN lockout under concurrency, against a real Postgres.
 *
 * A counter that is correct one request at a time proves nothing here: the
 * attack is many requests at once, and that is exactly what the first version
 * got wrong. So the central test fires a burst in parallel and asserts that the
 * lock engaged anyway.
 */

let studentId: string;

beforeEach(async () => {
  if (studentId) await db.execute(sql`DELETE FROM students WHERE id = ${studentId}`);
  const pinHash = await hashPin("1234");
  const [row] = await db.execute<{ id: string }>(
    sql`INSERT INTO students (display_name, pin_hash)
        VALUES (${`Lockout Test ${Date.now()}`}, ${pinHash}) RETURNING id`,
  );
  studentId = row.id;
});

afterAll(async () => {
  await db.execute(sql`DELETE FROM students WHERE id = ${studentId}`);
  await getClient().end();
});

async function state() {
  const [row] = await db.execute<{ failed_attempts: number; locked_until: Date | null }>(
    sql`SELECT failed_attempts, locked_until FROM students WHERE id = ${studentId}`,
  );
  return row;
}

describe("recordFailedPin", () => {
  it("counts down, then locks on the limit", async () => {
    for (let left = MAX_FAILED_ATTEMPTS - 1; left >= 1; left -= 1) {
      expect(await recordFailedPin(studentId)).toEqual({
        locked: false,
        attemptsRemaining: left,
      });
    }
    const last = await recordFailedPin(studentId);
    expect(last.locked).toBe(true);
  });

  it("locks under a parallel burst, which the old counter did not", async () => {
    // Twenty wrong guesses at once. The racy version read 0 twenty times and
    // wrote 1 twenty times, and never locked.
    const results = await Promise.all(
      Array.from({ length: 20 }, () => recordFailedPin(studentId)),
    );

    const after = await state();
    expect(after.locked_until).not.toBeNull();
    expect(new Date(after.locked_until!).getTime()).toBeGreaterThan(Date.now());

    // Exactly the allowance counted as ordinary wrong guesses; everything after
    // the lock engaged was refused as locked.
    const unlocked = results.filter((r) => !r.locked).length;
    expect(unlocked).toBe(MAX_FAILED_ATTEMPTS - 1);
  });

  it("does not count guesses made during a lockout", async () => {
    await db.execute(
      sql`UPDATE students SET locked_until = now() + interval '10 minutes' WHERE id = ${studentId}`,
    );
    expect((await recordFailedPin(studentId)).locked).toBe(true);
    expect((await state()).failed_attempts).toBe(0);
  });
});

describe("acceptCorrectPin", () => {
  it("clears the counter when not locked", async () => {
    await recordFailedPin(studentId);
    expect(await acceptCorrectPin(studentId)).toBe(true);
    expect((await state()).failed_attempts).toBe(0);
  });

  it("refuses a correct PIN while the lock is in force", async () => {
    // The correct guess that was in flight when the burst locked the student.
    await db.execute(
      sql`UPDATE students SET locked_until = now() + interval '10 minutes' WHERE id = ${studentId}`,
    );
    expect(await acceptCorrectPin(studentId)).toBe(false);
  });

  it("accepts again once the lock has expired", async () => {
    await db.execute(
      sql`UPDATE students SET locked_until = now() - interval '1 minute' WHERE id = ${studentId}`,
    );
    expect(await acceptCorrectPin(studentId)).toBe(true);
    expect((await state()).locked_until).toBeNull();
  });
});
