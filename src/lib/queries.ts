import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

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

/**
 * Read helpers for the student side.
 *
 * These live outside `src/app` so they are importable and testable without the
 * framework, and so route files stay thin: a page's job is to fetch and render,
 * not to know how a shift is looked up.
 */

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

/** The student's currently open shift, if any. `clock_out IS NULL` is the flag. */
export async function getOpenShift(studentId: string) {
  return db.query.shifts.findFirst({
    where: and(eq(shifts.studentId, studentId), isNull(shifts.clockOut)),
  });
}

export interface ActiveShift {
  id: string;
  clockIn: Date;
  studentId: string;
  studentName: string;
}

/**
 * Resolves the shift id from the session cookie into a shift that is still
 * open. Returns null for an unknown or already closed shift, so a stale cookie
 * sends the student back to sign-in instead of into a broken screen.
 */
export async function getActiveShift(shiftId: string): Promise<ActiveShift | null> {
  const row = await db
    .select({
      id: shifts.id,
      clockIn: shifts.clockIn,
      studentId: shifts.studentId,
      studentName: students.displayName,
    })
    .from(shifts)
    .innerJoin(students, eq(students.id, shifts.studentId))
    .where(and(eq(shifts.id, shiftId), isNull(shifts.clockOut)))
    .limit(1);

  return row[0] ?? null;
}

/** Totals for the dashboard stats. One query, computed in the database. */
export async function getShiftTotals(shiftId: string) {
  const row = await db
    .select({
      orderCount: sql<number>`count(*)::int`,
      salesCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
    })
    .from(orders)
    .where(eq(orders.shiftId, shiftId));

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
}

export async function listTeachers(): Promise<TeacherSummary[]> {
  return db
    .select({
      id: teacherProfiles.personId,
      name: persons.name,
      room: teacherProfiles.room,
      email: persons.email,
      notes: teacherProfiles.notes,
    })
    .from(teacherProfiles)
    .innerJoin(persons, eq(persons.id, teacherProfiles.personId))
    .where(eq(teacherProfiles.active, true))
    .orderBy(asc(persons.name));
}

export async function getTeacher(teacherId: string): Promise<TeacherSummary | null> {
  const rows = await db
    .select({
      id: teacherProfiles.personId,
      name: persons.name,
      room: teacherProfiles.room,
      email: persons.email,
      notes: teacherProfiles.notes,
    })
    .from(teacherProfiles)
    .innerJoin(persons, eq(persons.id, teacherProfiles.personId))
    .where(eq(teacherProfiles.personId, teacherId))
    .limit(1);

  return rows[0] ?? null;
}

/** Orders completed during this shift, newest first, for the "today" screen. */
export async function listShiftOrders(shiftId: string) {
  return db
    .select({
      id: orders.id,
      totalCents: orders.totalCents,
      createdAt: orders.createdAt,
      teacherName: persons.name,
      room: teacherProfiles.room,
    })
    .from(orders)
    .innerJoin(teacherProfiles, eq(teacherProfiles.personId, orders.teacherId))
    .innerJoin(persons, eq(persons.id, teacherProfiles.personId))
    .where(eq(orders.shiftId, shiftId))
    .orderBy(desc(orders.createdAt));
}
