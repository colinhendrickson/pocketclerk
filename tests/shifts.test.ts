import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { db, getClient } from "@/db";
import { hashPin } from "@/lib/auth";
import { getActiveShift } from "@/lib/queries";
import {
  clockOutShift,
  closeShiftByStaff,
  listAutoClosedShifts,
  listOpenShifts,
  startShift,
} from "@/lib/shifts";

/**
 * Opening and closing shifts. A forgotten clock-out must never be resumed days
 * later and paid as one long shift, so a shift left open past midnight is
 * closed with no hours and flagged for staff.
 */

const ZONE = "America/New_York";
// Noon in the cart's zone, so "today" is unambiguous whatever the machine's clock.
const NOW = new Date("2026-03-10T16:00:00Z");
const EARLIER_TODAY = new Date("2026-03-10T13:30:00Z");
const DAYS_AGO = new Date("2026-03-07T15:00:00Z");
/**
 * Postgres keeps microseconds and `clock_in` defaults to `now()`, so real rows
 * carry them; a JavaScript Date keeps only milliseconds. Written as a literal
 * because `toISOString()` would drop the last three digits.
 */
const DAYS_AGO_WITH_MICROS = "2026-03-07 15:00:00.011518+00";

let studentId: string;

beforeAll(async () => {
  const [student] = await db.execute<{ id: string }>(
    sql`INSERT INTO students (display_name, pin_hash)
        VALUES (${`Shift Test ${Date.now()}`}, ${await hashPin("1234")}) RETURNING id`,
  );
  studentId = student.id;
});

afterEach(async () => {
  await db.execute(sql`DELETE FROM shifts WHERE student_id = ${studentId}`);
});

afterAll(async () => {
  await db.execute(sql`DELETE FROM students WHERE id = ${studentId}`);
  await getClient().end();
});

async function openShiftAt(clockIn: Date | string): Promise<string> {
  const literal = typeof clockIn === "string" ? clockIn : clockIn.toISOString();
  const [row] = await db.execute<{ id: string }>(
    sql`INSERT INTO shifts (student_id, clock_in)
        VALUES (${studentId}, ${literal}::timestamptz) RETURNING id`,
  );
  return row.id;
}

async function shiftRow(id: string) {
  const [row] = await db.execute<{
    clock_in: string;
    clock_out: string | null;
    hours_hundredths: number | null;
    reward_tickets: number | null;
    auto_closed: boolean;
  }>(
    sql`SELECT clock_in::text, clock_out::text, hours_hundredths, reward_tickets, auto_closed
        FROM shifts WHERE id = ${id}`,
  );
  return row;
}

async function openCount(): Promise<number> {
  const [row] = await db.execute<{ n: number }>(
    sql`SELECT count(*)::int AS n FROM shifts WHERE student_id = ${studentId} AND clock_out IS NULL`,
  );
  return row.n;
}

describe("startShift", () => {
  it("opens a shift when none is open", async () => {
    const result = await startShift(studentId, NOW, ZONE);
    expect(result).toMatchObject({ resumed: false, closedStale: false });
    expect(await openCount()).toBe(1);
  });

  it("resumes a shift opened earlier today", async () => {
    const open = await openShiftAt(EARLIER_TODAY);
    const result = await startShift(studentId, NOW, ZONE);
    expect(result).toEqual({ shiftId: open, resumed: true, closedStale: false });
    expect((await shiftRow(open)).clock_out).toBeNull();
  });

  it("closes a shift left open from an earlier day with no hours, then opens a fresh one", async () => {
    const stale = await openShiftAt(DAYS_AGO);
    const result = await startShift(studentId, NOW, ZONE);

    expect(result.resumed).toBe(false);
    expect(result.closedStale).toBe(true);
    expect(result.shiftId).not.toBe(stale);

    const closed = await shiftRow(stale);
    expect(closed.clock_out).toBe(closed.clock_in);
    expect(closed.hours_hundredths).toBe(0);
    expect(closed.reward_tickets).toBe(0);
    expect(closed.auto_closed).toBe(true);
    expect(await openCount()).toBe(1);
  });

  it("closes a stale shift whose clock-in carries microseconds", async () => {
    // Rounding clock_in to milliseconds on the way through JavaScript and
    // writing it back as clock_out lands before clock_in, and the database
    // refuses the row (shifts_ordered_check). This is what production does.
    const stale = await openShiftAt(DAYS_AGO_WITH_MICROS);
    const result = await startShift(studentId, NOW, ZONE);
    expect(result.closedStale).toBe(true);

    const closed = await shiftRow(stale);
    expect(closed.clock_out).toBe(closed.clock_in);
    expect(closed.auto_closed).toBe(true);
    expect(await openCount()).toBe(1);
  });

  it("treats a shift from before local midnight as stale, even within 24 hours", async () => {
    // 11pm the night before, local time (EDT, UTC-4).
    const stale = await openShiftAt(new Date("2026-03-10T03:00:00Z"));
    const result = await startShift(studentId, NOW, ZONE);
    expect(result.closedStale).toBe(true);
    expect((await shiftRow(stale)).auto_closed).toBe(true);
  });

  it("settles on one fresh shift when two clock-ins race over a stale one", async () => {
    await openShiftAt(DAYS_AGO);
    const [a, b] = await Promise.all([
      startShift(studentId, NOW, ZONE),
      startShift(studentId, NOW, ZONE),
    ]);
    expect(a.shiftId).toBe(b.shiftId);
    expect(await openCount()).toBe(1);
  });
});

describe("clockOutShift", () => {
  it("records hours and tickets for a shift from today", async () => {
    const open = await openShiftAt(EARLIER_TODAY);
    expect(await clockOutShift(open, NOW, ZONE)).toEqual({
      hoursHundredths: 250,
      tickets: 2,
      autoClosed: false,
    });
  });

  it("credits no hours to a shift left open from an earlier day", async () => {
    const stale = await openShiftAt(DAYS_AGO);
    expect(await clockOutShift(stale, NOW, ZONE)).toEqual({
      hoursHundredths: 0,
      tickets: 0,
      autoClosed: true,
    });
    expect((await shiftRow(stale)).auto_closed).toBe(true);
  });

  it("credits no hours to a stale shift whose clock-in carries microseconds", async () => {
    const stale = await openShiftAt(DAYS_AGO_WITH_MICROS);
    expect(await clockOutShift(stale, NOW, ZONE)).toEqual({
      hoursHundredths: 0,
      tickets: 0,
      autoClosed: true,
    });
    const closed = await shiftRow(stale);
    expect(closed.clock_out).toBe(closed.clock_in);
  });

  it("does not rewrite a shift that is already closed", async () => {
    const open = await openShiftAt(EARLIER_TODAY);
    await clockOutShift(open, NOW, ZONE);
    const later = new Date(NOW.getTime() + 60 * 60 * 1000);
    expect(await clockOutShift(open, later, ZONE)).toBeNull();
    expect((await shiftRow(open)).hours_hundredths).toBe(250);
  });
});

describe("staff follow-up", () => {
  it("lists open shifts with the student's name", async () => {
    const open = await openShiftAt(DAYS_AGO);
    const rows = await listOpenShifts();
    const row = rows.find((r) => r.id === open);
    expect(row?.studentName).toMatch(/^Shift Test/);
    expect(row?.clockIn.toISOString()).toBe(DAYS_AGO.toISOString());
  });

  it("closes a stuck shift with no hours, once", async () => {
    const open = await openShiftAt(DAYS_AGO);
    expect(await closeShiftByStaff(open, NOW)).toBe(true);
    const closed = await shiftRow(open);
    expect(closed.hours_hundredths).toBe(0);
    expect(closed.reward_tickets).toBe(0);
    expect(closed.clock_out).not.toBeNull();
    expect(await closeShiftByStaff(open, NOW)).toBe(false);
  });

  it("lists shifts the system closed, newest first, since a date", async () => {
    const stale = await openShiftAt(DAYS_AGO);
    await startShift(studentId, NOW, ZONE);

    const rows = await listAutoClosedShifts(new Date("2026-03-01T00:00:00Z"));
    const row = rows.find((r) => r.id === stale);
    expect(row?.studentName).toMatch(/^Shift Test/);
    expect(row?.clockIn.toISOString()).toBe(DAYS_AGO.toISOString());

    expect(
      (await listAutoClosedShifts(new Date("2026-03-08T00:00:00Z"))).some((r) => r.id === stale),
    ).toBe(false);
  });
});

describe("getActiveShift", () => {
  it("does not treat a shift left open from an earlier day as active", async () => {
    // The device is sent back to sign-in, where the old shift is closed with no hours.
    const stale = await openShiftAt(DAYS_AGO);
    expect(await getActiveShift(stale, NOW, ZONE)).toBeNull();
    await db.execute(sql`DELETE FROM shifts WHERE id = ${stale}`);

    const current = await openShiftAt(EARLIER_TODAY);
    expect((await getActiveShift(current, NOW, ZONE))?.id).toBe(current);
  });
});
