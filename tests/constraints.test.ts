import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db, getClient } from "@/db";
import { hashPin } from "@/lib/auth";

/**
 * Proves the database refuses what the schema says is impossible.
 *
 * These are the two guarantees the application leans on hardest, and asserting
 * them here is the difference between "the code checks that" and "the database
 * will not allow it". Both run against a real Postgres, locally and in CI,
 * because a constraint that was never exercised is a constraint that might have
 * a typo in it.
 */


/**
 * Runs a statement that is expected to fail and returns the Postgres error
 * detail. Drizzle wraps driver errors, so the SQLSTATE code and the constraint
 * name live on `cause`; asserting on those rather than on message text means a
 * test names the exact rule it is proving.
 */
async function violation(
  run: () => Promise<unknown>,
): Promise<{ code?: string; constraint?: string }> {
  try {
    await run();
  } catch (error) {
    const cause = (error as { cause?: { code?: string; constraint_name?: string } })
      .cause;
    return { code: cause?.code, constraint: cause?.constraint_name };
  }
  throw new Error("Expected the statement to be rejected, but it succeeded.");
}

/** SQLSTATE 23505 unique_violation, 23514 check_violation. */
const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";

let studentId: string;
let teacherId: string;

beforeAll(async () => {
  const pinHash = await hashPin("1234");
  const [student] = await db.execute<{ id: string }>(
    sql`INSERT INTO students (display_name, pin_hash)
        VALUES ('Constraint Test', ${pinHash}) RETURNING id`,
  );
  studentId = student.id;

  const [person] = await db.execute<{ id: string }>(
    sql`INSERT INTO persons (name) VALUES ('Constraint Teacher') RETURNING id`,
  );
  await db.execute(sql`INSERT INTO teacher_profiles (person_id) VALUES (${person.id})`);
  teacherId = person.id;
});

afterAll(async () => {
  // Children before parents: orders reference both shifts and teachers, and
  // shifts reference students. Anything left behind shows up as a real teacher
  // in the running application, so the cleanup covers every row that points at
  // these fixtures rather than only the ones this file created.
  await db.execute(
    sql`DELETE FROM orders
        WHERE teacher_id = ${teacherId}
           OR shift_id IN (SELECT id FROM shifts WHERE student_id = ${studentId})`,
  );
  await db.execute(sql`DELETE FROM shifts WHERE student_id = ${studentId}`);
  await db.execute(sql`DELETE FROM students WHERE id = ${studentId}`);
  await db.execute(sql`DELETE FROM teacher_profiles WHERE person_id = ${teacherId}`);
  await db.execute(sql`DELETE FROM persons WHERE id = ${teacherId}`);
  await getClient().end();
});

describe("one open shift per student", () => {
  it("allows the first clock-in", async () => {
    await expect(
      db.execute(sql`INSERT INTO shifts (student_id) VALUES (${studentId})`),
    ).resolves.toBeDefined();
  });

  it("refuses a second open shift", async () => {
    // This is the double clock-in case. Two concurrent requests can both pass
    // an application-level check; neither can satisfy the unique index twice.
    const failure = await violation(() =>
      db.execute(sql`INSERT INTO shifts (student_id) VALUES (${studentId})`),
    );
    expect(failure.code).toBe(UNIQUE_VIOLATION);
    expect(failure.constraint).toBe("one_open_shift_per_student");
  });

  it("allows a new shift once the previous one is closed", async () => {
    await db.execute(
      sql`UPDATE shifts SET clock_out = now(), hours_hundredths = 100, reward_tickets = 1
          WHERE student_id = ${studentId} AND clock_out IS NULL`,
    );
    await expect(
      db.execute(sql`INSERT INTO shifts (student_id) VALUES (${studentId})`),
    ).resolves.toBeDefined();
  });
});

describe("order money constraints", () => {
  async function insertOrder(
    totalCents: number,
    receivedCents: number | null,
    changeCents: number | null,
  ) {
    return db.execute(sql`
      INSERT INTO orders (shift_id, teacher_id, total_cents, payment_method, received_cents, change_cents)
      SELECT id, ${teacherId}, ${totalCents}, 'cash', ${receivedCents}, ${changeCents}
      FROM shifts WHERE student_id = ${studentId} AND clock_out IS NULL LIMIT 1
    `);
  }

  it("accepts an order whose change adds up", async () => {
    await expect(insertOrder(200, 500, 300)).resolves.toBeDefined();
  });

  it("refuses change that does not equal received minus total", async () => {
    const failure = await violation(() => insertOrder(200, 500, 999));
    expect(failure.code).toBe(CHECK_VIOLATION);
    expect(failure.constraint).toBe("orders_payment_fields_check");
  });

  it("refuses a payment that does not cover the total", async () => {
    const failure = await violation(() => insertOrder(500, 200, 0));
    expect(failure.code).toBe(CHECK_VIOLATION);
    expect(failure.constraint).toBe("orders_payment_fields_check");
  });

  it("refuses a cash order with no money recorded", async () => {
    const failure = await violation(() => insertOrder(200, null, null));
    expect(failure.code).toBe(CHECK_VIOLATION);
    expect(failure.constraint).toBe("orders_payment_fields_check");
  });

  it("refuses a negative total", async () => {
    const failure = await violation(() => insertOrder(-100, 0, 100));
    expect(failure.code).toBe(CHECK_VIOLATION);
  });
});

describe("shift completeness", () => {
  it("refuses a half-closed shift", async () => {
    // Either a shift is open and has no derived values, or it is closed and has
    // both. A clock-out that recorded hours but no tickets is not a valid row.
    const failure = await violation(() =>
      db.execute(
        sql`UPDATE shifts SET clock_out = now(), hours_hundredths = 250
            WHERE student_id = ${studentId} AND clock_out IS NULL`,
      ),
    );
    expect(failure.code).toBe(CHECK_VIOLATION);
    expect(failure.constraint).toBe("shifts_closed_fields_check");
  });
});
