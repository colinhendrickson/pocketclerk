import { sql } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { db, getClient } from "@/db";
import { seedDatabase } from "@/db/seed-data";
import { canStartOver, isDemo, resetDue } from "@/lib/demo";

/**
 * The demo's data: a reset that runs in one transaction, at most one at a time,
 * and a guard that needs both the deployment's mode and the database's flag.
 */

const original = process.env.NEXT_PUBLIC_SITE_MODE;

afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_MODE;
  else process.env.NEXT_PUBLIC_SITE_MODE = original;
});

afterAll(async () => {
  // Later test files expect the ordinary seed, not the demo's.
  await seedDatabase({ demo: false });
  await getClient().end();
});

const at = (minutes: number, seconds = 0) => new Date(Date.UTC(2026, 8, 24, 12, minutes, seconds));
const start = at(0);

describe("resetDue", () => {
  it("is due when the demo has never been reset", () => {
    expect(resetDue(null, start)).toBe(true);
  });

  it("waits a full hour", () => {
    expect(resetDue(start, at(59, 59))).toBe(false);
    expect(resetDue(start, at(60))).toBe(true);
  });
});

describe("canStartOver", () => {
  it("is allowed when the demo has never been reset", () => {
    expect(canStartOver(null, start)).toBe(true);
  });

  it("waits five minutes between presses", () => {
    expect(canStartOver(start, at(4, 59))).toBe(false);
    expect(canStartOver(start, at(5))).toBe(true);
  });
});

async function flags() {
  const [row] = await db.execute<{ is_demo: boolean; demo_reset_at: string | null }>(
    sql`SELECT is_demo, demo_reset_at FROM site_settings WHERE id = 1`,
  );
  return row;
}

describe("seedDatabase", () => {
  it("marks the database as the demo's", async () => {
    expect(await seedDatabase({ demo: true })).toBe("seeded");
    const row = await flags();
    expect(row.is_demo).toBe(true);
    expect(row.demo_reset_at).not.toBeNull();
  });

  it("leaves an ordinary database unmarked", async () => {
    expect(await seedDatabase({ demo: false })).toBe("seeded");
    expect((await flags()).is_demo).toBe(false);
  });

  it("seeds the cart: students, teachers, an administrator, a menu", async () => {
    await seedDatabase({ demo: true });
    const [counts] = await db.execute<{ students: number; admins: number; menu: number }>(
      sql`SELECT (SELECT count(*)::int FROM students) AS students,
                 (SELECT count(*)::int FROM admin_users) AS admins,
                 (SELECT count(*)::int FROM menu_items) AS menu`,
    );
    expect(counts).toEqual({ students: 6, admins: 1, menu: 5 });
  });

  it("runs once when two resets start together", async () => {
    const results = await Promise.all([seedDatabase({ demo: true }), seedDatabase({ demo: true })]);
    expect(results.sort()).toEqual(["busy", "seeded"]);

    // And the one that ran left a whole cart, not half of one.
    const [row] = await db.execute<{ students: number }>(sql`SELECT count(*)::int AS students FROM students`);
    expect(row.students).toBe(6);
  });
});

describe("isDemo", () => {
  it("needs the demo's mode and the demo's database", async () => {
    await seedDatabase({ demo: true });
    process.env.NEXT_PUBLIC_SITE_MODE = "demo";
    expect(await isDemo()).toBe(true);
  });

  it("refuses a school's database, even with the demo's mode set by mistake", async () => {
    await seedDatabase({ demo: false });
    process.env.NEXT_PUBLIC_SITE_MODE = "demo";
    expect(await isDemo()).toBe(false);
  });

  it("refuses a school's copy pointed at a demo database", async () => {
    await seedDatabase({ demo: true });
    delete process.env.NEXT_PUBLIC_SITE_MODE;
    expect(await isDemo()).toBe(false);
  });
});
