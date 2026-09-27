import { eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { adminUsers, persons } from "@/db/schema";
import { parseNewAdmin } from "@/lib/validate";

/**
 * Who can use the admin side, and changing that from inside it.
 *
 * Access used to be granted only by a command-line script, which meant every
 * new member of staff was a request to the developer. The allowlist is still
 * the whole authorization model (see admin-auth.ts); this is the same table,
 * managed from a page instead.
 *
 * Removing access removes the `admin_users` row and nothing else. The person
 * stays, because they may also be a teacher with an order history. The admin
 * layout re-reads the allowlist on every request, so removal takes effect on
 * their next click rather than when their session expires.
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
 * Gives someone access by their email address.
 *
 * Someone with that address already in the system, usually a teacher who buys
 * from the cart, is reused rather than duplicated: one person, one order
 * history, whatever roles they hold. `created` says which happened.
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
 * Takes away someone's access.
 *
 * Two refusals, both there so that a school can never lock itself out:
 * nobody removes themselves, and the last administrator is never removed.
 *
 * The count and the delete happen under a lock on every admin row. Without
 * it, two administrators removing each other at the same moment would each see
 * two administrators, each delete one, and leave none.
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
