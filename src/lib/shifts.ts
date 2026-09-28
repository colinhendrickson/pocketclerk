import { and, asc, desc, eq, gte, isNull } from "drizzle-orm";

import { db } from "@/db";
import { shifts, students } from "@/db/schema";
import { hoursHundredthsBetween, rewardTickets } from "@/lib/money";
import { isUniqueViolation } from "@/lib/pg-errors";
import { localDate, startOfLocalDay, TIME_ZONE } from "@/lib/time";

/**
 * Opening and closing shifts. A shift still open from an earlier day is a
 * forgotten clock-out: it is closed with no hours and flagged for staff
 * (`auto_closed`) instead of being resumed and paid as one long shift.
 */

function isStale(clockIn: Date, now: Date, timeZone: string): boolean {
  return clockIn < startOfLocalDay(localDate(now, timeZone), timeZone);
}

export interface StartShiftResult {
  shiftId: string;
  /** The student already had a shift open today. */
  resumed: boolean;
  /** A forgotten shift from an earlier day was closed first. */
  closedStale: boolean;
}

/**
 * Clock-in: resumes today's open shift, or closes a stale one and opens a
 * fresh one. Callers verify the PIN first.
 */
export async function startShift(
  studentId: string,
  now: Date = new Date(),
  timeZone: string = TIME_ZONE,
): Promise<StartShiftResult> {
  try {
    return await startShiftOnce(studentId, now, timeZone);
  } catch (error) {
    // A concurrent clock-in opened the shift first; the retry resumes it.
    if (isUniqueViolation(error)) return startShiftOnce(studentId, now, timeZone);
    throw error;
  }
}

async function startShiftOnce(
  studentId: string,
  now: Date,
  timeZone: string,
): Promise<StartShiftResult> {
  return db.transaction(async (tx) => {
    const [open] = await tx
      .select({ id: shifts.id, clockIn: shifts.clockIn })
      .from(shifts)
      .where(and(eq(shifts.studentId, studentId), isNull(shifts.clockOut)))
      .for("update");

    if (open && !isStale(open.clockIn, now, timeZone)) {
      return { shiftId: open.id, resumed: true, closedStale: false };
    }

    if (open) {
      await tx
        .update(shifts)
        .set({ clockOut: open.clockIn, hoursHundredths: 0, rewardTickets: 0, autoClosed: true })
        .where(and(eq(shifts.id, open.id), isNull(shifts.clockOut)));
    }

    const [shift] = await tx.insert(shifts).values({ studentId }).returning({ id: shifts.id });
    return { shiftId: shift.id, resumed: false, closedStale: Boolean(open) };
  });
}

export interface ClockOutShiftResult {
  hoursHundredths: number;
  tickets: number;
  /** The shift was from an earlier day, so no hours were credited. */
  autoClosed: boolean;
}

/**
 * Clock-out: snapshots hours and tickets from server time. Returns null if the
 * shift is already closed, so a double tap cannot rewrite the hours.
 */
export async function clockOutShift(
  shiftId: string,
  now: Date = new Date(),
  timeZone: string = TIME_ZONE,
): Promise<ClockOutShiftResult | null> {
  const [open] = await db
    .select({ clockIn: shifts.clockIn })
    .from(shifts)
    .where(and(eq(shifts.id, shiftId), isNull(shifts.clockOut)));
  if (!open) return null;

  const stale = isStale(open.clockIn, now, timeZone);
  const hoursHundredths = stale ? 0 : hoursHundredthsBetween(open.clockIn, now);
  const tickets = rewardTickets(hoursHundredths);

  const updated = await db
    .update(shifts)
    .set(
      stale
        ? { clockOut: open.clockIn, hoursHundredths, rewardTickets: tickets, autoClosed: true }
        : { clockOut: now, hoursHundredths, rewardTickets: tickets },
    )
    .where(and(eq(shifts.id, shiftId), isNull(shifts.clockOut)))
    .returning({ id: shifts.id });

  return updated.length > 0 ? { hoursHundredths, tickets, autoClosed: stale } : null;
}

/**
 * Staff close a stuck shift from the admin side. No hours are credited, since
 * nobody knows when the student really stopped. False if already closed.
 */
export async function closeShiftByStaff(shiftId: string, now: Date = new Date()): Promise<boolean> {
  const updated = await db
    .update(shifts)
    .set({ clockOut: now, hoursHundredths: 0, rewardTickets: 0 })
    .where(and(eq(shifts.id, shiftId), isNull(shifts.clockOut)))
    .returning({ id: shifts.id });
  return updated.length > 0;
}

export interface ShiftFollowUpRow {
  id: string;
  studentName: string;
  clockIn: Date;
}

/** Every open shift, oldest first, for the admin home page. */
export async function listOpenShifts(): Promise<ShiftFollowUpRow[]> {
  return db
    .select({ id: shifts.id, studentName: students.displayName, clockIn: shifts.clockIn })
    .from(shifts)
    .innerJoin(students, eq(students.id, shifts.studentId))
    .where(isNull(shifts.clockOut))
    .orderBy(asc(shifts.clockIn));
}

/** Shifts the system closed with no hours since `since`, newest first. */
export async function listAutoClosedShifts(since: Date, limit = 10): Promise<ShiftFollowUpRow[]> {
  return db
    .select({ id: shifts.id, studentName: students.displayName, clockIn: shifts.clockIn })
    .from(shifts)
    .innerJoin(students, eq(students.id, shifts.studentId))
    .where(and(eq(shifts.autoClosed, true), gte(shifts.clockIn, since)))
    .orderBy(desc(shifts.clockIn))
    .limit(limit);
}
