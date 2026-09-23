import { sql } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { db, getClient } from "@/db";
import { addAdmin, listAdmins, removeAdmin } from "@/lib/admins";

/**
 * Giving and removing admin access, against a real Postgres.
 *
 * The rules that matter are the refusals: nobody can remove themselves, and
 * the last administrator can never be removed, because either would leave a
 * school locked out of its own cart with no way back in but the developer.
 * The last one is tested under concurrency, since two administrators removing
 * each other at the same moment is exactly how a check-then-delete fails.
 */

const created: string[] = [];

async function person(name: string, email: string | null) {
  const [row] = await db.execute<{ id: string }>(
    sql`INSERT INTO persons (name, email) VALUES (${name}, ${email}) RETURNING id`,
  );
  created.push(row.id);
  return row.id;
}

async function isAdmin(personId: string) {
  const rows = await db.execute(sql`SELECT 1 FROM admin_users WHERE person_id = ${personId}`);
  return rows.length === 1;
}

afterEach(async () => {
  for (const id of created.splice(0)) {
    await db.execute(sql`DELETE FROM admin_login_tokens WHERE person_id = ${id}`);
    await db.execute(sql`DELETE FROM admin_users WHERE person_id = ${id}`);
    await db.execute(sql`DELETE FROM persons WHERE id = ${id}`);
  }
});

afterAll(async () => {
  await getClient().end();
});

describe("addAdmin", () => {
  it("adds a new person and lists them with who added them", async () => {
    const by = await person("Test Admin One", `one-${Date.now()}@example.edu`);
    await db.execute(sql`INSERT INTO admin_users (person_id) VALUES (${by})`);

    const email = `new-${Date.now()}@example.edu`;
    const result = await addAdmin({ name: "Test New Admin", email: email.toUpperCase() }, by);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    created.push(result.personId);

    const listed = (await listAdmins()).find((a) => a.personId === result.personId);
    expect(listed).toMatchObject({ name: "Test New Admin", email, addedByName: "Test Admin One" });
  });

  it("reuses a teacher who already has that email, so their order history stays theirs", async () => {
    const email = `teacher-${Date.now()}@example.edu`;
    const teacher = await person("Test Teacher", email);

    const result = await addAdmin({ name: "Typed Differently", email }, null);
    expect(result).toEqual({ ok: true, personId: teacher, created: false });
    expect(await isAdmin(teacher)).toBe(true);
  });

  it("says so when the person already has access", async () => {
    const email = `dupe-${Date.now()}@example.edu`;
    const first = await addAdmin({ name: "Test Dupe", email }, null);
    if (first.ok) created.push(first.personId);
    expect(await addAdmin({ name: "Test Dupe", email }, null)).toEqual({
      ok: false,
      error: "already",
    });
  });

  it("refuses an address that is not an email", async () => {
    expect(await addAdmin({ name: "Test Bad", email: "not-an-email" }, null)).toEqual({
      ok: false,
      error: "invalid",
    });
  });
});

describe("removeAdmin", () => {
  async function twoAdmins() {
    const a = await person("Test Remover", `a-${Date.now()}@example.edu`);
    const b = await person("Test Removed", `b-${Date.now()}@example.edu`);
    await db.execute(sql`INSERT INTO admin_users (person_id) VALUES (${a}), (${b})`);
    return { a, b };
  }

  it("removes another administrator", async () => {
    const { a, b } = await twoAdmins();
    expect(await removeAdmin(b, a)).toEqual({ ok: true });
    expect(await isAdmin(b)).toBe(false);
    // The person stays: they may be a teacher with orders.
    const still = await db.execute(sql`SELECT 1 FROM persons WHERE id = ${b}`);
    expect(still.length).toBe(1);
  });

  it("will not let anyone remove themselves", async () => {
    const { a } = await twoAdmins();
    expect(await removeAdmin(a, a)).toEqual({ ok: false, error: "self" });
    expect(await isAdmin(a)).toBe(true);
  });

  it("never removes the last administrator, even when two remove each other at once", async () => {
    // Only these two may be administrators for this to test the last one, so
    // everyone else is set aside for the duration and put back after.
    const others = await db.execute<{ person_id: string; added_by: string | null }>(
      sql`DELETE FROM admin_users RETURNING person_id, added_by`,
    );
    try {
      const { a, b } = await twoAdmins();

      // Left to themselves the two removals rarely overlap, and a test that
      // only fails when the timing is unlucky proves nothing. So this holds a
      // lock on every admin row while both removals start, then lets go, which
      // puts them on top of each other every time: each has read "two
      // administrators" before either deletes.
      let removals!: Promise<Awaited<ReturnType<typeof removeAdmin>>[]>;
      await getClient().begin(async (hold) => {
        await hold`SELECT person_id FROM admin_users FOR UPDATE`;
        removals = Promise.all([removeAdmin(b, a), removeAdmin(a, b)]);
        await new Promise((resolve) => setTimeout(resolve, 300));
      });
      const results = await removals;

      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, error: "last" }]);
      const left = await db.execute(sql`SELECT person_id FROM admin_users`);
      expect(left.length).toBe(1);
    } finally {
      await db.execute(sql`DELETE FROM admin_users`);
      for (const row of others) {
        await db.execute(
          sql`INSERT INTO admin_users (person_id, added_by) VALUES (${row.person_id}, ${row.added_by})`,
        );
      }
    }
  });
});
