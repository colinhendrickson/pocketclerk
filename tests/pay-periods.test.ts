import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { db, getClient } from "@/db";
import { listStudentsWithTotals } from "@/lib/admin-queries";
import { hashPin } from "@/lib/auth";
import { getCurrentPayPeriod, listPastPayPeriods, startPayPeriod } from "@/lib/pay-periods";

/**
 * Pay periods (4.23) and name corrections (4.22), against a real database.
 *
 * Staff asked how to "reset the hours for the next paycheck". Nothing is reset:
 * a period only moves the point the roster counts from, so these tests pin
 * that hours land in exactly one period and that lifetime totals never move.
 */

let personId: string;
let studentId: string;
let otherStudentId: string;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/(admin)/admin/require-admin", () => ({
  requireAdmin: vi.fn(async () => ({ personId, name: "Pay Admin", email: "pay@example.test" })),
}));

async function addShift(clockOut: string, hours: number): Promise<void> {
  await db.execute(sql`
    INSERT INTO shifts (student_id, clock_in, clock_out, hours_hundredths, reward_tickets)
    VALUES (${studentId}, ${clockOut}::timestamptz - interval '1 hour', ${clockOut}::timestamptz,
            ${hours}, ${Math.floor(hours / 100)})
  `);
}

/** Removes every period, newest first: each one is referenced by the next. */
async function clearPeriods(): Promise<void> {
  for (;;) {
    const deleted = await db.execute<{ id: string }>(sql`
      DELETE FROM pay_periods
       WHERE id NOT IN (SELECT previous_id FROM pay_periods WHERE previous_id IS NOT NULL)
      RETURNING id
    `);
    if (deleted.length === 0) return;
  }
}

beforeAll(async () => {
  await clearPeriods();
  const [person] = await db.execute<{ id: string }>(
    sql`INSERT INTO persons (name) VALUES ('Pay Admin') RETURNING id`,
  );
  personId = person.id;
  const stamp = Date.now();
  const [student] = await db.execute<{ id: string }>(
    sql`INSERT INTO students (display_name, pin_hash)
        VALUES (${`Pay Test ${stamp}`}, ${await hashPin("1234")}) RETURNING id`,
  );
  studentId = student.id;
  const [other] = await db.execute<{ id: string }>(
    sql`INSERT INTO students (display_name, pin_hash)
        VALUES (${`Pay Other ${stamp}`}, ${await hashPin("1234")}) RETURNING id`,
  );
  otherStudentId = other.id;
});

afterEach(clearPeriods);

afterAll(async () => {
  await db.execute(sql`DELETE FROM shifts WHERE student_id IN (${studentId}, ${otherStudentId})`);
  await db.execute(sql`DELETE FROM students WHERE id IN (${studentId}, ${otherStudentId})`);
  await db.execute(sql`DELETE FROM persons WHERE id = ${personId}`);
  await getClient().end();
});

describe("starting a pay period", () => {
  it("starts the first one, then refuses a second click on the same page", async () => {
    expect(await getCurrentPayPeriod()).toEqual({ id: null, startedAt: null });

    expect(await startPayPeriod({ previousId: null, startedBy: personId })).toEqual({ ok: true });
    const first = await getCurrentPayPeriod();
    expect(first.id).not.toBeNull();

    // The same page clicked again still thinks there is no period.
    expect(await startPayPeriod({ previousId: null, startedBy: personId })).toEqual({
      ok: false,
      error: "stale",
    });

    expect(await startPayPeriod({ previousId: first.id, startedBy: personId })).toEqual({
      ok: true,
    });
    expect((await getCurrentPayPeriod()).id).not.toBe(first.id);
  });

  it("starts exactly one when two clicks race", async () => {
    const results = await Promise.all([
      startPayPeriod({ previousId: null, startedBy: personId }),
      startPayPeriod({ previousId: null, startedBy: personId }),
      startPayPeriod({ previousId: null, startedBy: personId }),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const [{ count }] = await db.execute<{ count: number }>(
      sql`SELECT count(*)::int AS count FROM pay_periods`,
    );
    expect(count).toBe(1);
  });

  it("is refused by the database too, not only by the check before it", async () => {
    await db.execute(sql`INSERT INTO pay_periods (previous_id) VALUES (NULL)`);
    await expect(
      db.execute(sql`INSERT INTO pay_periods (previous_id) VALUES (NULL)`),
    ).rejects.toThrow();
  });
});

describe("hours per pay period", () => {
  // Far-future instants no other test writes near.
  const P1 = "2032-01-01T12:00:00Z";
  const P2 = "2032-01-15T12:00:00Z";

  it("puts each shift in the period it was clocked out in, and leaves lifetime totals alone", async () => {
    await addShift("2031-12-20T15:00:00Z", 150); // before any period
    await addShift("2032-01-05T15:00:00Z", 225); // first period
    await addShift("2032-01-14T15:00:00Z", 100); // first period
    await addShift("2032-01-20T15:00:00Z", 300); // current period

    const [first] = await db.execute<{ id: string }>(
      sql`INSERT INTO pay_periods (started_at) VALUES (${P1}::timestamptz) RETURNING id`,
    );
    await db.execute(
      sql`INSERT INTO pay_periods (started_at, previous_id) VALUES (${P2}::timestamptz, ${first.id})`,
    );

    const current = await getCurrentPayPeriod();
    expect(current.startedAt?.toISOString()).toBe(new Date(P2).toISOString());

    const rows = await listStudentsWithTotals(current.startedAt);
    const mine = rows.find((row) => row.id === studentId);
    expect(mine).toMatchObject({
      periodShiftCount: 1,
      periodHoursHundredths: 300,
      shiftCount: 4,
      hoursHundredths: 775,
      rewardTickets: 7,
    });
    const other = rows.find((row) => row.id === otherStudentId);
    expect(other).toMatchObject({ periodShiftCount: 0, periodHoursHundredths: 0 });

    const past = await listPastPayPeriods();
    expect(past.map((period) => period.endedAt.toISOString())).toEqual([
      new Date(P2).toISOString(),
      new Date(P1).toISOString(),
    ]);
    expect(past[0].startedAt.toISOString()).toBe(new Date(P1).toISOString());
    expect(past[0].students.find((s) => s.studentId === studentId)).toMatchObject({
      shiftCount: 2,
      hoursHundredths: 325,
    });
    // The open-ended first period holds the shift from before staff started one.
    expect(past[1].students.find((s) => s.studentId === studentId)).toMatchObject({
      shiftCount: 1,
      hoursHundredths: 150,
    });
    // A student with no shifts in a period is not listed in it.
    expect(past[0].students.find((s) => s.studentId === otherStudentId)).toBeUndefined();
  });

  it("counts every shift as the current period before any period is started", async () => {
    const rows = await listStudentsWithTotals(null);
    const mine = rows.find((row) => row.id === studentId);
    expect(mine?.periodHoursHundredths).toBe(mine?.hoursHundredths);
    expect(await listPastPayPeriods()).toEqual([]);
  });
});

describe("the admin actions", () => {
  it("renames a student without touching their shifts, and refuses a name in use", async () => {
    const { renameStudent } = await import("@/app/(admin)/admin/students/actions");
    const newName = `Pay Test Lastname ${Date.now()}`;

    expect(await renameStudent({ studentId, displayName: `  ${newName}  ` })).toEqual({ ok: true });
    const [row] = await db.execute<{ display_name: string; shifts: number }>(sql`
      SELECT display_name, (SELECT count(*)::int FROM shifts WHERE student_id = ${studentId}) AS shifts
        FROM students WHERE id = ${studentId}
    `);
    expect(row.display_name).toBe(newName);
    expect(row.shifts).toBeGreaterThan(0);

    expect(
      await renameStudent({ studentId: otherStudentId, displayName: newName.toUpperCase() }),
    ).toEqual({ ok: false, error: "duplicate" });
    expect(await renameStudent({ studentId, displayName: "x" })).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(
      await renameStudent({
        studentId: "00000000-0000-4000-8000-000000000000",
        displayName: "Nobody Here",
      }),
    ).toEqual({ ok: false, error: "not_found" });
  });

  it("starts a pay period as the signed-in admin", async () => {
    const { startNewPayPeriod } = await import("@/app/(admin)/admin/students/actions");

    expect(await startNewPayPeriod({ previousId: "not-a-uuid" })).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(await startNewPayPeriod({ previousId: null })).toEqual({ ok: true });
    const [period] = await db.execute<{ started_by: string }>(
      sql`SELECT started_by FROM pay_periods`,
    );
    expect(period.started_by).toBe(personId);
    expect(await startNewPayPeriod({ previousId: null })).toEqual({
      ok: false,
      error: "stale",
    });
  });
});
