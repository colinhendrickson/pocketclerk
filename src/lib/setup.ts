import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * What the cart still needs before it can run, read from the data itself.
 *
 * Nothing is stored: a step is done when the thing it asks for exists. So the
 * checklist cannot be ticked without the work being done, cannot be left
 * unticked after it is, and needs no migration. The one indirect step is the
 * iPad: connecting it leaves no row behind, but a student can only clock in on
 * a connected device, so the first shift is the proof.
 */

export interface SetupCounts {
  activeStudents: number;
  activeTeachers: number;
  teachersWithEmail: number;
  activeMenuItems: number;
  shifts: number;
  orders: number;
  admins: number;
}

export async function getSetupCounts(): Promise<SetupCounts> {
  const [row] = await db.execute<{
    active_students: number;
    active_teachers: number;
    teachers_with_email: number;
    active_menu_items: number;
    shifts: number;
    orders: number;
    admins: number;
  }>(sql`
    SELECT
      (SELECT count(*)::int FROM students WHERE active) AS active_students,
      (SELECT count(*)::int FROM teacher_profiles WHERE active) AS active_teachers,
      (SELECT count(*)::int FROM teacher_profiles t JOIN persons p ON p.id = t.person_id
         WHERE t.active AND coalesce(p.email, '') <> '') AS teachers_with_email,
      (SELECT count(*)::int FROM menu_items WHERE active) AS active_menu_items,
      (SELECT count(*)::int FROM (SELECT 1 FROM shifts LIMIT 1) s) AS shifts,
      (SELECT count(*)::int FROM (SELECT 1 FROM orders LIMIT 1) o) AS orders,
      (SELECT count(*)::int FROM admin_users) AS admins
  `);
  return {
    activeStudents: row?.active_students ?? 0,
    activeTeachers: row?.active_teachers ?? 0,
    teachersWithEmail: row?.teachers_with_email ?? 0,
    activeMenuItems: row?.active_menu_items ?? 0,
    shifts: row?.shifts ?? 0,
    orders: row?.orders ?? 0,
    admins: row?.admins ?? 0,
  };
}

export type SetupStepId = "students" | "teachers" | "menu" | "ipad" | "first-sale" | "admins";

export interface SetupStep {
  id: SetupStepId;
  done: boolean;
  /** Optional steps never hold up "setup complete". */
  optional: boolean;
  /** Where things stand, in words: "6 students", "2 of 12 teachers have no email". */
  status: string;
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Turns counts into steps. Pure, so the rules are tested without a database. */
export function setupChecklist(counts: SetupCounts): SetupStep[] {
  const missingEmail = counts.activeTeachers - counts.teachersWithEmail;
  return [
    {
      id: "students",
      done: counts.activeStudents > 0,
      optional: false,
      status: counts.activeStudents > 0 ? plural(counts.activeStudents, "student") : "No students yet",
    },
    {
      id: "teachers",
      // Done once there are teachers and every one of them has an email:
      // a teacher without one is served, but never gets a receipt.
      done: counts.activeTeachers > 0 && missingEmail === 0,
      optional: false,
      status:
        counts.activeTeachers === 0
          ? "No teachers yet"
          : missingEmail > 0
            ? `${missingEmail} of ${counts.activeTeachers} ${counts.activeTeachers === 1 ? "teacher has" : "teachers have"} no email`
            : `${plural(counts.activeTeachers, "teacher")}, all with emails`,
    },
    {
      id: "menu",
      done: counts.activeMenuItems > 0,
      optional: false,
      status: counts.activeMenuItems > 0 ? plural(counts.activeMenuItems, "item") : "Nothing on the menu yet",
    },
    {
      id: "ipad",
      done: counts.shifts > 0,
      optional: false,
      status: counts.shifts > 0 ? "Connected" : "Not connected yet",
    },
    {
      id: "first-sale",
      done: counts.orders > 0,
      optional: false,
      status: counts.orders > 0 ? "Done" : "No sales yet",
    },
    {
      id: "admins",
      done: counts.admins > 1,
      optional: true,
      status: counts.admins > 1 ? plural(counts.admins, "admin") : "Only you so far",
    },
  ];
}

export function setupComplete(steps: SetupStep[]): boolean {
  return steps.every((step) => step.optional || step.done);
}
