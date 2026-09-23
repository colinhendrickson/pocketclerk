import { sql } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { db, getClient } from "@/db";
import { insertTeacher } from "@/lib/teachers";

/**
 * Adding a teacher, which both the cart and the admin Teachers page do through
 * this one function. Name and room together are what make two teachers
 * different people, so that is the duplicate rule.
 */

const created: string[] = [];

afterEach(async () => {
  for (const id of created.splice(0)) {
    await db.execute(sql`DELETE FROM teacher_profiles WHERE person_id = ${id}`);
    await db.execute(sql`DELETE FROM persons WHERE id = ${id}`);
  }
});

afterAll(async () => {
  await getClient().end();
});

describe("insertTeacher", () => {
  it("adds a teacher with a room and an email", async () => {
    const name = `Test Teacher ${Date.now()}`;
    const result = await insertTeacher({ name, room: "212", email: "t@example.edu" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    created.push(result.teacher.id);
    expect(result.teacher).toMatchObject({ name, room: "212", email: "t@example.edu", notes: [] });
  });

  it("refuses the same name in the same room, whatever the case", async () => {
    const name = `Test Twin ${Date.now()}`;
    const first = await insertTeacher({ name, room: "5", email: null });
    if (first.ok) created.push(first.teacher.id);
    expect(await insertTeacher({ name: name.toUpperCase(), room: "5", email: null })).toEqual({
      ok: false,
      error: "duplicate",
    });
  });

  it("allows the same name in a different room", async () => {
    const name = `Test Shared ${Date.now()}`;
    const first = await insertTeacher({ name, room: "1", email: null });
    const second = await insertTeacher({ name, room: "2", email: null });
    for (const r of [first, second]) if (r.ok) created.push(r.teacher.id);
    expect(second.ok).toBe(true);
  });
});
