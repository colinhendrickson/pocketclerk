import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  addons,
  menuItems,
  orders,
  persons,
  shifts,
  students,
  teacherProfiles,
} from "@/db/schema";
import { TIME_ZONE, localDate, startOfLocalDay } from "@/lib/time";

/** Read helpers for the student side. */

export async function listActiveStudents() {
  return db
    .select({ id: students.id, displayName: students.displayName })
    .from(students)
    .where(eq(students.active, true))
    .orderBy(asc(students.displayName));
}

export async function getStudent(studentId: string) {
  return db.query.students.findFirst({ where: eq(students.id, studentId) });
}

export interface ActiveShift {
  id: string;
  clockIn: Date;
  studentId: string;
  studentName: string;
}

/**
 * The session's shift, if it is open and started today in the cart's time zone.
 * A shift left open from an earlier day is not active: the student signs in
 * again, which closes it with no hours (src/lib/shifts.ts).
 */
export async function getActiveShift(
  shiftId: string,
  now: Date = new Date(),
  timeZone: string = TIME_ZONE,
): Promise<ActiveShift | null> {
  const startOfToday = startOfLocalDay(localDate(now, timeZone), timeZone);
  const row = await db
    .select({
      id: shifts.id,
      clockIn: shifts.clockIn,
      studentId: shifts.studentId,
      studentName: students.displayName,
    })
    .from(shifts)
    .innerJoin(students, eq(students.id, shifts.studentId))
    .where(and(eq(shifts.id, shiftId), isNull(shifts.clockOut), gte(shifts.clockIn, startOfToday)))
    .limit(1);

  return row[0] ?? null;
}

/**
 * The crew's open shifts among `shiftIds`, longest-working first. Shifts since
 * closed, or left open from an earlier day, drop out, the same rule as
 * `getActiveShift`.
 */
export async function listCrew(
  shiftIds: readonly string[],
  now: Date = new Date(),
  timeZone: string = TIME_ZONE,
): Promise<ActiveShift[]> {
  if (shiftIds.length === 0) return [];
  const startOfToday = startOfLocalDay(localDate(now, timeZone), timeZone);
  return db
    .select({
      id: shifts.id,
      clockIn: shifts.clockIn,
      studentId: shifts.studentId,
      studentName: students.displayName,
    })
    .from(shifts)
    .innerJoin(students, eq(students.id, shifts.studentId))
    .where(
      and(
        inArray(shifts.id, [...shiftIds]),
        isNull(shifts.clockOut),
        gte(shifts.clockIn, startOfToday),
      ),
    )
    .orderBy(asc(shifts.clockIn));
}

/**
 * Order count and sales for the cart today, across every student who worked
 * it: with several on one shift, "my orders" would hide half the morning.
 */
export async function getTodaysTotals(now: Date = new Date(), timeZone: string = TIME_ZONE) {
  const startOfToday = startOfLocalDay(localDate(now, timeZone), timeZone);
  const row = await db
    .select({
      orderCount: sql<number>`count(*)::int`,
      salesCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
    })
    .from(orders)
    .where(gte(orders.createdAt, startOfToday));

  return row[0] ?? { orderCount: 0, salesCents: 0 };
}

export async function listMenu() {
  return db
    .select()
    .from(menuItems)
    .where(eq(menuItems.active, true))
    .orderBy(asc(menuItems.sortOrder), asc(menuItems.name));
}

export async function listAddons() {
  return db
    .select()
    .from(addons)
    .where(eq(addons.active, true))
    .orderBy(asc(addons.sortOrder), asc(addons.name));
}

export interface TeacherSummary {
  id: string;
  name: string;
  room: string | null;
  email: string | null;
  notes: string[];
  /** Shown as a hint on the staff card choice; never chooses for the student. */
  prefersCard: boolean;
}

export async function listTeachers(): Promise<TeacherSummary[]> {
  return db
    .select({
      id: teacherProfiles.personId,
      name: persons.name,
      room: teacherProfiles.room,
      email: persons.email,
      notes: teacherProfiles.notes,
      prefersCard: teacherProfiles.prefersCard,
    })
    .from(teacherProfiles)
    .innerJoin(persons, eq(persons.id, teacherProfiles.personId))
    .where(eq(teacherProfiles.active, true))
    .orderBy(asc(persons.name));
}

/** The cart's orders today, newest first, with who rang each up. */
export async function listTodaysOrders(now: Date = new Date(), timeZone: string = TIME_ZONE) {
  const startOfToday = startOfLocalDay(localDate(now, timeZone), timeZone);
  return db
    .select({
      id: orders.id,
      totalCents: orders.totalCents,
      paymentMethod: orders.paymentMethod,
      createdAt: orders.createdAt,
      teacherName: persons.name,
      room: teacherProfiles.room,
      studentName: students.displayName,
    })
    .from(orders)
    .innerJoin(teacherProfiles, eq(teacherProfiles.personId, orders.teacherId))
    .innerJoin(persons, eq(persons.id, teacherProfiles.personId))
    .innerJoin(shifts, eq(shifts.id, orders.shiftId))
    .innerJoin(students, eq(students.id, shifts.studentId))
    .where(gte(orders.createdAt, startOfToday))
    .orderBy(desc(orders.createdAt));
}

export interface ShiftSummary {
  id: string;
  studentName: string;
  hoursHundredths: number;
  rewardTickets: number;
}

/**
 * A closed shift, for the post-clock-out summary screen. The session cookie
 * outlives the shift by that one screen; everywhere else uses `getActiveShift`.
 */
export async function getFinishedShift(shiftId: string): Promise<ShiftSummary | null> {
  const rows = await db
    .select({
      id: shifts.id,
      studentName: students.displayName,
      hoursHundredths: shifts.hoursHundredths,
      rewardTickets: shifts.rewardTickets,
    })
    .from(shifts)
    .innerJoin(students, eq(students.id, shifts.studentId))
    .where(and(eq(shifts.id, shiftId), isNotNull(shifts.clockOut)))
    .limit(1);

  const row = rows[0];
  if (!row || row.hoursHundredths === null || row.rewardTickets === null) return null;
  return {
    id: row.id,
    studentName: row.studentName,
    hoursHundredths: row.hoursHundredths,
    rewardTickets: row.rewardTickets,
  };
}
