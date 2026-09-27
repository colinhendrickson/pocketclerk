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
 * Adds a teacher (`persons` plus `teacher_profiles`) in one transaction. Shared
 * by the cart and the admin Teachers page. Duplicates are matched on name and
 * room together, case-insensitively. Callers validate input
 * (`parseNewTeacher`) and check permissions.
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
