import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { persons, teacherProfiles } from "@/db/schema";
import type { NewTeacherInput } from "@/lib/validate";

export interface NewTeacher {
  id: string;
  name: string;
  room: string | null;
  email: string | null;
  notes: string[];
}

export type InsertTeacherResult =
  | { ok: true; teacher: NewTeacher }
  | { ok: false; error: "duplicate" };

/**
 * Adds a teacher: a `persons` row and its `teacher_profiles` row, together.
 *
 * Shared by the cart, where a student adds a teacher mid-order, and the admin
 * Teachers page, so both apply the same duplicate rule. Two teachers can share
 * a surname; what makes them different people on this cart is the classroom,
 * so the guard is on name and room together.
 *
 * Callers validate first (`parseNewTeacher`) and check their own permissions.
 */
export async function insertTeacher(input: NewTeacherInput): Promise<InsertTeacherResult> {
  const existing = await db
    .select({ id: persons.id })
    .from(persons)
    .innerJoin(teacherProfiles, eq(teacherProfiles.personId, persons.id))
    .where(
      and(
        sql`lower(${persons.name}) = lower(${input.name})`,
        input.room
          ? sql`lower(coalesce(${teacherProfiles.room}, '')) = lower(${input.room})`
          : sql`coalesce(${teacherProfiles.room}, '') = ''`,
      ),
    )
    .limit(1);

  if (existing.length > 0) return { ok: false, error: "duplicate" };

  const teacher = await db.transaction(async (tx) => {
    const [person] = await tx
      .insert(persons)
      .values({ name: input.name, email: input.email })
      .returning({ id: persons.id, name: persons.name, email: persons.email });

    const [profile] = await tx
      .insert(teacherProfiles)
      .values({ personId: person.id, room: input.room })
      .returning({ room: teacherProfiles.room, notes: teacherProfiles.notes });

    return {
      id: person.id,
      name: person.name,
      email: person.email,
      room: profile.room,
      notes: profile.notes,
    };
  });

  return { ok: true, teacher };
}
