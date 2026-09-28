import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { db, getClient } from "@/db";
import { addAdmin, listAdmins, removeAdmin, transferOwnership } from "@/lib/admins";

/**
 * The owner: the one admin who gives and removes access. Nobody can remove the
 * owner, so staff cannot lock the person responsible for the cart out of it.
 */

const created: string[] = [];
let originalOwner: string | null = null;

async function admin(name: string) {
  const [row] = await db.execute<{ id: string }>(
    sql`INSERT INTO persons (name, email) VALUES (${name}, ${`${name.replace(/\W/g, "")}-${Date.now()}@example.edu`}) RETURNING id`,
  );
  created.push(row.id);
  await db.execute(sql`INSERT INTO admin_users (person_id) VALUES (${row.id})`);
  return row.id;
}

async function makeOwner(personId: string) {
  await db.execute(sql`UPDATE admin_users SET is_owner = false WHERE is_owner`);
  await db.execute(sql`UPDATE admin_users SET is_owner = true WHERE person_id = ${personId}`);
}

async function ownerId() {
  const [row] = await db.execute<{ person_id: string }>(
    sql`SELECT person_id FROM admin_users WHERE is_owner`,
  );
  return row?.person_id ?? null;
}

beforeEach(async () => {
  originalOwner = await ownerId();
});

afterEach(async () => {
  await db.execute(sql`UPDATE admin_users SET is_owner = false WHERE is_owner`);
  if (originalOwner) await makeOwner(originalOwner);
  for (const id of created.splice(0)) {
    await db.execute(sql`DELETE FROM admin_users WHERE person_id = ${id}`);
    await db.execute(sql`DELETE FROM persons WHERE id = ${id}`);
  }
});

afterAll(async () => {
  await getClient().end();
});

describe("the owner", () => {
  it("is the only admin who can give or remove access", async () => {
    const owner = await admin("Test Owner");
    const staff = await admin("Test Staff");
    const other = await admin("Test Other");
    await makeOwner(owner);

    expect(await addAdmin({ name: "Test New", email: `new-${Date.now()}@example.edu` }, staff)).toEqual({
      ok: false,
      error: "not_owner",
    });
    expect(await removeAdmin(other, staff)).toEqual({ ok: false, error: "not_owner" });
    expect(await removeAdmin(other, owner)).toEqual({ ok: true });
  });

  it("cannot be removed by anyone", async () => {
    const owner = await admin("Test Owner");
    await makeOwner(owner);
    const staff = await admin("Test Staff");
    // Even with no owner check in the way, the owner row itself is protected.
    await db.execute(sql`UPDATE admin_users SET is_owner = false WHERE person_id = ${staff}`);
    expect(await removeAdmin(owner, staff)).toEqual({ ok: false, error: "not_owner" });
    expect((await listAdmins()).find((a) => a.personId === owner)?.isOwner).toBe(true);
  });

  it("can hand the role to another admin, and then manages access no longer", async () => {
    const owner = await admin("Test Owner");
    const next = await admin("Test Next");
    await makeOwner(owner);

    expect(await transferOwnership(next, owner)).toEqual({ ok: true });
    expect(await ownerId()).toBe(next);
    expect(await addAdmin({ name: "Test Late", email: `late-${Date.now()}@example.edu` }, owner)).toEqual({
      ok: false,
      error: "not_owner",
    });
  });

  it("can only be handed on by the owner, and only to an admin", async () => {
    const owner = await admin("Test Owner");
    const staff = await admin("Test Staff");
    await makeOwner(owner);

    expect(await transferOwnership(owner, staff)).toEqual({ ok: false, error: "not_owner" });
    const [outsider] = await db.execute<{ id: string }>(
      sql`INSERT INTO persons (name) VALUES ('Test Outsider') RETURNING id`,
    );
    created.push(outsider.id);
    expect(await transferOwnership(outsider.id, owner)).toEqual({ ok: false, error: "not_found" });
    expect(await ownerId()).toBe(owner);
  });

  it("is held by one admin at most, enforced by the database", async () => {
    const owner = await admin("Test Owner");
    const staff = await admin("Test Staff");
    await makeOwner(owner);
    await expect(
      db.execute(sql`UPDATE admin_users SET is_owner = true WHERE person_id = ${staff}`),
    ).rejects.toThrow();
  });

  it("is the first admin on a new deployment", async () => {
    const others = await db.execute<{ person_id: string; added_by: string | null; is_owner: boolean }>(
      sql`DELETE FROM admin_users RETURNING person_id, added_by, is_owner`,
    );
    try {
      const result = await addAdmin({ name: "Test First", email: `first-${Date.now()}@example.edu` }, null);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      created.push(result.personId);
      expect(await ownerId()).toBe(result.personId);
    } finally {
      await db.execute(sql`DELETE FROM admin_users`);
      for (const row of others) {
        await db.execute(
          sql`INSERT INTO admin_users (person_id, added_by, is_owner)
              VALUES (${row.person_id}, ${row.added_by}, ${row.is_owner})`,
        );
      }
    }
  });
});
