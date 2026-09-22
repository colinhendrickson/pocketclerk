import { asc, eq, sql } from "drizzle-orm";

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
 * Read helpers for the administrator's screens.
 *
 * Separate from `queries.ts`, which serves the cart: the two audiences want
 * opposite things from the same tables. The student side reads only `active`
 * rows and only the current shift; the admin side reads everything, including
 * what has been deactivated, because managing the list is the whole job.
 *
 * Every total here is computed in Postgres rather than by summing rows in
 * JavaScript. A student with three years of shifts is a few hundred rows that
 * would otherwise cross the wire to produce one number.
 */

/* -------------------------------------------------------------------------- */
/* Students                                                                   */
/* -------------------------------------------------------------------------- */

export interface StudentRow {
  id: string;
  displayName: string;
  active: boolean;
  shiftCount: number;
  /** Lifetime hours, in hundredths. Formatted with `formatHours` at the edge. */
  hoursHundredths: number;
  rewardTickets: number;
}

/**
 * Every student with their lifetime totals.
 *
 * A LEFT JOIN, not an inner one: a student added this morning has no shifts and
 * must still appear, with zeros. `hours_hundredths` and `reward_tickets` are
 * null while a shift is open, so both sums coalesce — an open shift contributes
 * nothing until it is closed and its values are snapshotted.
 */
export async function listStudentsWithTotals(): Promise<StudentRow[]> {
  return db
    .select({
      id: students.id,
      displayName: students.displayName,
      active: students.active,
      shiftCount: sql<number>`count(${shifts.id})::int`,
      hoursHundredths: sql<number>`coalesce(sum(${shifts.hoursHundredths}), 0)::int`,
      rewardTickets: sql<number>`coalesce(sum(${shifts.rewardTickets}), 0)::int`,
    })
    .from(students)
    .leftJoin(shifts, eq(shifts.studentId, students.id))
    .groupBy(students.id, students.displayName, students.active)
    .orderBy(asc(students.displayName));
}

/* -------------------------------------------------------------------------- */
/* Teachers                                                                   */
/* -------------------------------------------------------------------------- */

export interface TeacherOrderRow {
  id: string;
  teacherId: string;
  totalCents: number;
  createdAt: Date;
}

export interface TeacherRow {
  id: string;
  name: string;
  room: string | null;
  email: string | null;
  active: boolean;
  notes: string[];
  orderCount: number;
  totalSpentCents: number;
  /** Newest first, capped at ten. See `listTeachersWithTotals`. */
  recentOrders: TeacherOrderRow[];
}

const RECENT_ORDERS_PER_TEACHER = 10;

/**
 * Every teacher with their note list, order count, lifetime spend and last ten
 * orders.
 *
 * The recent orders are fetched in one windowed query for all teachers rather
 * than one query per expanded row. The alternative — loading a teacher's orders
 * when their row is opened — needs a round trip, a loading state and an error
 * state for a payload that is at most ten rows per teacher; a school has tens
 * of teachers, not thousands, so the whole set is cheaper than the machinery
 * for fetching part of it.
 *
 * Note count is `array_length` rather than a join: the notes live in a text
 * array on the profile, so the count is already on the row being read.
 */
export async function listTeachersWithTotals(): Promise<TeacherRow[]> {
  const profiles = await db
    .select({
      id: teacherProfiles.personId,
      name: persons.name,
      room: teacherProfiles.room,
      email: persons.email,
      active: teacherProfiles.active,
      notes: teacherProfiles.notes,
      orderCount: sql<number>`count(${orders.id})::int`,
      totalSpentCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
    })
    .from(teacherProfiles)
    .innerJoin(persons, eq(persons.id, teacherProfiles.personId))
    .leftJoin(orders, eq(orders.teacherId, teacherProfiles.personId))
    .groupBy(
      teacherProfiles.personId,
      persons.name,
      teacherProfiles.room,
      persons.email,
      teacherProfiles.active,
      teacherProfiles.notes,
    )
    .orderBy(asc(persons.name));

  const recent = await db.execute<{
    id: string;
    teacher_id: string;
    total_cents: number;
    created_at: Date;
  }>(sql`
    SELECT id, teacher_id, total_cents, created_at
    FROM (
      SELECT
        o.id,
        o.teacher_id,
        o.total_cents,
        o.created_at,
        row_number() OVER (
          PARTITION BY o.teacher_id ORDER BY o.created_at DESC, o.id DESC
        ) AS rn
      FROM orders o
    ) ranked
    WHERE rn <= ${RECENT_ORDERS_PER_TEACHER}
    ORDER BY teacher_id, created_at DESC
  `);

  const byTeacher = new Map<string, TeacherOrderRow[]>();
  for (const row of recent) {
    const list = byTeacher.get(row.teacher_id) ?? [];
    list.push({
      id: row.id,
      teacherId: row.teacher_id,
      totalCents: row.total_cents,
      // postgres.js hands back a Date for timestamptz, but the raw-SQL path is
      // untyped, so this is normalised here rather than trusted downstream.
      createdAt: new Date(row.created_at),
    });
    byTeacher.set(row.teacher_id, list);
  }

  return profiles.map((profile) => ({
    ...profile,
    recentOrders: byTeacher.get(profile.id) ?? [],
  }));
}

/* -------------------------------------------------------------------------- */
/* Menu                                                                       */
/* -------------------------------------------------------------------------- */

export interface MenuItemRow {
  id: string;
  name: string;
  priceCents: number;
  isSpecial: boolean;
  active: boolean;
}

export interface AddonRow {
  id: string;
  name: string;
  priceCents: number;
  active: boolean;
}

/**
 * Both menu lists, including deactivated rows.
 *
 * Ordered so the list reads the way the cart does — `sort_order` first, name as
 * the tiebreak — rather than putting inactive rows last. An administrator
 * looking for the item she switched off yesterday finds it where she left it.
 */
export async function listMenuForAdmin(): Promise<MenuItemRow[]> {
  return db
    .select({
      id: menuItems.id,
      name: menuItems.name,
      priceCents: menuItems.priceCents,
      isSpecial: menuItems.isSpecial,
      active: menuItems.active,
    })
    .from(menuItems)
    .orderBy(asc(menuItems.sortOrder), asc(menuItems.name));
}

export async function listAddonsForAdmin(): Promise<AddonRow[]> {
  return db
    .select({
      id: addons.id,
      name: addons.name,
      priceCents: addons.priceCents,
      active: addons.active,
    })
    .from(addons)
    .orderBy(asc(addons.sortOrder), asc(addons.name));
}
