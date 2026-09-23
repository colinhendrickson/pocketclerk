"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { persons, teacherProfiles } from "@/db/schema";
import { insertTeacher } from "@/lib/teachers";
import {
  parseActiveToggle,
  parseNewTeacher,
  parseTeacherEdit,
  parseTeacherNote,
  parseTeacherNoteRemoval,
} from "@/lib/validate";

import { requireAdmin } from "../require-admin";

/**
 * Server actions for the teacher list.
 *
 * `requireAdmin()` is the first statement in every one. A Server Action is a
 * POST endpoint of its own; the admin layout never runs for it, so a guard in
 * the layout would leave all of these open.
 *
 * A teacher is two rows — the `persons` row that holds the name and email, and
 * the `teacher_profiles` row that holds the room, the notes and the active
 * flag. Anything that touches both writes them in one transaction, so a teacher
 * can never end up renamed on one row and not the other.
 */

export type AddTeacherResult =
  | { ok: true; name: string }
  | { ok: false; error: "invalid" | "duplicate" };

/**
 * Adds a teacher from the admin side, with the same rules as the cart.
 *
 * Mostly for first-time setup: entering the teachers before the cart ever
 * runs, so students tap a name instead of typing one, and so receipts go out
 * from the first sale because the emails are already there.
 */
export async function addTeacher(input: unknown): Promise<AddTeacherResult> {
  await requireAdmin();

  const parsed = parseNewTeacher(input);
  if (!parsed) return { ok: false, error: "invalid" };

  const result = await insertTeacher(parsed);
  if (!result.ok) return result;

  revalidatePath("/admin/teachers");
  revalidatePath("/admin");
  return { ok: true, name: result.teacher.name };
}

export type UpdateTeacherResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "not_found" | "duplicate" };

/**
 * Edits a teacher's name, room and email.
 *
 * The email matters more than it looks: it is the only thing that decides
 * whether a sale queues an emailed receipt, so correcting a typo here is what
 * turns a teacher's receipts back on. Past orders are untouched, because their
 * receipts were already addressed and delivered.
 *
 * The duplicate guard is on name and room together, matching the student-side
 * `createTeacher`. Two teachers genuinely can share a surname; what makes them
 * different people on this cart is which classroom they are in.
 */
export async function updateTeacher(input: unknown): Promise<UpdateTeacherResult> {
  await requireAdmin();

  const parsed = parseTeacherEdit(input);
  if (!parsed) return { ok: false, error: "invalid" };

  const clash = await db
    .select({ id: persons.id })
    .from(persons)
    .innerJoin(teacherProfiles, eq(teacherProfiles.personId, persons.id))
    .where(
      and(
        ne(persons.id, parsed.teacherId),
        sql`lower(${persons.name}) = lower(${parsed.name})`,
        parsed.room
          ? sql`lower(coalesce(${teacherProfiles.room}, '')) = lower(${parsed.room})`
          : sql`coalesce(${teacherProfiles.room}, '') = ''`,
      ),
    )
    .limit(1);

  if (clash.length > 0) return { ok: false, error: "duplicate" };

  const found = await db.transaction(async (tx) => {
    const profile = await tx
      .update(teacherProfiles)
      .set({ room: parsed.room })
      .where(eq(teacherProfiles.personId, parsed.teacherId))
      .returning({ id: teacherProfiles.personId });

    if (profile.length === 0) return false;

    await tx
      .update(persons)
      .set({ name: parsed.name, email: parsed.email })
      .where(eq(persons.id, parsed.teacherId));

    return true;
  });

  if (!found) return { ok: false, error: "not_found" };

  revalidatePath("/admin/teachers");
  return { ok: true };
}

export type TeacherNoteResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "not_found" };

/**
 * Appends a note to the teacher's list.
 *
 * `array_append` in the database rather than read-modify-write in JavaScript:
 * the append is then one atomic statement, so a note added from a second tab
 * cannot be overwritten by this one saving a list it read before that happened.
 */
export async function addTeacherNote(input: unknown): Promise<TeacherNoteResult> {
  await requireAdmin();

  const parsed = parseTeacherNote(input);
  if (!parsed) return { ok: false, error: "invalid" };

  const updated = await db
    .update(teacherProfiles)
    .set({
      notes: sql`array_append(${teacherProfiles.notes}, ${parsed.note})`,
    })
    .where(eq(teacherProfiles.personId, parsed.teacherId))
    .returning({ id: teacherProfiles.personId });

  if (updated.length === 0) return { ok: false, error: "not_found" };

  revalidatePath("/admin/teachers");
  return { ok: true };
}

/**
 * Removes one note by its position in the list.
 *
 * Postgres arrays have no delete-by-index, and the slice-and-concatenate
 * expression that emulates it is unreadable, so this reads the row and writes
 * it back inside a transaction with `FOR UPDATE`. The lock is what makes that
 * safe: without it, two concurrent removals would each write a list computed
 * from the same starting state and one deletion would silently come back.
 *
 * An index past the end of the list is treated as already gone rather than as
 * an error — that is what a double-submitted delete looks like, and it is not
 * something to show the administrator a failure for.
 */
export async function removeTeacherNote(input: unknown): Promise<TeacherNoteResult> {
  await requireAdmin();

  const parsed = parseTeacherNoteRemoval(input);
  if (!parsed) return { ok: false, error: "invalid" };

  const found = await db.transaction(async (tx) => {
    const rows = await tx
      .select({ notes: teacherProfiles.notes })
      .from(teacherProfiles)
      .where(eq(teacherProfiles.personId, parsed.teacherId))
      .for("update")
      .limit(1);

    const current = rows[0]?.notes;
    if (!current) return false;
    if (parsed.index >= current.length) return true;

    const next = current.filter((_, position) => position !== parsed.index);
    await tx
      .update(teacherProfiles)
      .set({ notes: next })
      .where(eq(teacherProfiles.personId, parsed.teacherId));

    return true;
  });

  if (!found) return { ok: false, error: "not_found" };

  revalidatePath("/admin/teachers");
  return { ok: true };
}

export type SetTeacherActiveResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "not_found" };

/**
 * Soft delete. A teacher who has left the school comes off the cart's list and
 * keeps every order they were ever charged for, which is what makes the sales
 * history add up.
 */
export async function setTeacherActive(
  input: unknown,
): Promise<SetTeacherActiveResult> {
  await requireAdmin();

  const parsed = parseActiveToggle(input);
  if (!parsed) return { ok: false, error: "invalid" };

  const updated = await db
    .update(teacherProfiles)
    .set({ active: parsed.active })
    .where(eq(teacherProfiles.personId, parsed.id))
    .returning({ id: teacherProfiles.personId });

  if (updated.length === 0) return { ok: false, error: "not_found" };

  revalidatePath("/admin/teachers");
  return { ok: true };
}
