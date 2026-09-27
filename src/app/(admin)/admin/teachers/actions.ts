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
 * Teacher list server actions. Each calls `requireAdmin()` first: a server
 * action is its own POST endpoint and does not pass through the layout.
 *
 * A teacher spans two rows, `persons` (name, email) and `teacher_profiles`
 * (room, notes, active); writes touching both use one transaction.
 */

export type AddTeacherResult =
  | { ok: true; name: string }
  | { ok: false; error: "invalid" | "duplicate" };

/**
 * Adds a teacher via the same `insertTeacher` rules the cart uses. Mainly for
 * entering teachers before the cart's first day.
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
 * Edits a teacher's name, room and email. The email decides whether future
 * sales queue an emailed receipt; past orders are unaffected.
 *
 * Duplicates are checked on name and room together (case-insensitive), matching
 * the cart-side `createTeacher`.
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
 * Appends a note. Uses `array_append` so the write is atomic and cannot clobber
 * a concurrent append.
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
 * Removes one note by index. Postgres arrays have no delete-by-index, so this
 * reads and rewrites the row under `FOR UPDATE`; the lock stops concurrent
 * removals from resurrecting each other's deletions.
 *
 * An out-of-range index (e.g. a double submit) is treated as already removed.
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
 * Soft-deletes or restores a teacher. Inactive teachers leave the cart's list
 * but keep their order history.
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
