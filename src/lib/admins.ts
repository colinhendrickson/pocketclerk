import { eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { adminUsers, persons } from "@/db/schema";
import { parseNewAdmin } from "@/lib/validate";

/**
 * Managing the admin allowlist (`admin_users`; see admin-auth.ts).
 *
 * Removing access deletes only the `admin_users` row; the person remains, since
 * they may also be a teacher with order history. Removal takes effect on the
 * next request because the allowlist is re-read every time.
 */

export interface AdminListing {
  personId: string;
  name: string;
  email: string | null;
  addedByName: string | null;
  since: Date;
}

export async function listAdmins(): Promise<AdminListing[]> {
  const addedBy = alias(persons, "added_by_person");
  return db
    .select({
      personId: adminUsers.personId,
      name: persons.name,
      email: persons.email,
      addedByName: addedBy.name,
      since: adminUsers.createdAt,
    })
    .from(adminUsers)
    .innerJoin(persons, eq(persons.id, adminUsers.personId))
    .leftJoin(addedBy, eq(addedBy.id, adminUsers.addedBy))
    .orderBy(sql`lower(${persons.name})`);
}

export type AddAdminResult =
  | { ok: true; personId: string; created: boolean }
  | { ok: false; error: "invalid" | "already" };

/**
 * Grants access by email. An existing person with that address is reused
 * rather than duplicated; `created` reports whether a new person was inserted.
 */
export async function addAdmin(input: unknown, addedBy: string | null): Promise<AddAdminResult> {
  const parsed = parseNewAdmin(input);
  if (!parsed) return { ok: false, error: "invalid" };

  const [existing] = await db
    .select({ id: persons.id })
    .from(persons)
    .where(sql`lower(${persons.email}) = ${parsed.email}`)
    .limit(1);

  let personId = existing?.id;
  const created = !personId;
  if (!personId) {
    const [row] = await db
      .insert(persons)
      .values({ name: parsed.name, email: parsed.email })
      .returning({ id: persons.id });
    personId = row.id;
  }

  const inserted = await db
    .insert(adminUsers)
    .values({ personId, addedBy })
    .onConflictDoNothing()
    .returning({ personId: adminUsers.personId });

  if (inserted.length === 0) return { ok: false, error: "already" };
  return { ok: true, personId, created };
}

export type RemoveAdminResult =
  | { ok: true }
  | { ok: false; error: "self" | "last" | "not_found" };

/**
 * Revokes access. Refuses self-removal and removal of the last admin, so the
 * deployment cannot lock itself out. The count and delete run under
 * `FOR UPDATE` on all admin rows so concurrent mutual removals cannot leave
 * zero admins.
 */
export async function removeAdmin(personId: string, by: string): Promise<RemoveAdminResult> {
  if (personId === by) return { ok: false, error: "self" };

  return db.transaction(async (tx) => {
    const admins = await tx.execute<{ person_id: string }>(
      sql`SELECT person_id FROM admin_users FOR UPDATE`,
    );
    if (admins.length <= 1) return { ok: false, error: "last" } as const;
    if (!admins.some((a) => a.person_id === personId)) {
      return { ok: false, error: "not_found" } as const;
    }

    await tx.delete(adminUsers).where(eq(adminUsers.personId, personId));
    return { ok: true } as const;
  });
}
