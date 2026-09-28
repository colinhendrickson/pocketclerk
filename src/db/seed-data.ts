import { faker } from "@faker-js/faker";
import { sql } from "drizzle-orm";

import { hashPin } from "../lib/auth";
import { db } from "./index";
import {
  addons,
  adminUsers,
  inventoryItems,
  menuItems,
  persons,
  siteSettings,
  students,
  teacherProfiles,
} from "./schema";

/**
 * Fictional seed data for development, tests, and the hourly demo reset. All
 * people are generated; real data enters only through the admin UI. The faker
 * seed is fixed for reproducible tests and screenshots.
 */

/** Shared PIN for every seeded student. */
export const DEMO_PIN = "1234";

/**
 * Advisory lock key. Concurrent demo resets are possible across instances; the
 * loser skips instead of truncating mid-seed.
 */
const SEED_LOCK = 36_002_026;

export type SeedResult = "seeded" | "busy";

export interface SeedSummary {
  menu: number;
  addons: number;
  students: number;
  teachers: number;
  supplies: number;
  adminEmail: string | null;
}

/**
 * Truncates and reseeds in one transaction, so concurrent readers see either
 * the old data or the new. `demo` sets `site_settings.is_demo` (see
 * src/lib/demo.ts). Returns "busy" without changes if another seed holds the lock.
 */
export async function seedDatabase(
  options: { demo: boolean },
  onSeeded?: (summary: SeedSummary) => void,
): Promise<SeedResult> {
  faker.seed(20260903);
  // Hash outside the transaction to keep the lock short.
  const pinHash = await hashPin(DEMO_PIN);

  return db.transaction(async (tx) => {
    const [lock] = await tx.execute<{ locked: boolean }>(
      sql`SELECT pg_try_advisory_xact_lock(${SEED_LOCK}) AS locked`,
    );
    if (!lock.locked) return "busy";

    // site_settings references persons, so it is truncated too and rewritten below.
    await tx.execute(
      sql`TRUNCATE order_item_addons, order_items, receipt_jobs, orders,
          inventory_counts, inventory_items, shifts, students, teacher_profiles,
          admin_users, persons, menu_items, addons, site_settings
          RESTART IDENTITY CASCADE`,
    );

    // --- Menu -------------------------------------------------------------
    // Flat $1 pricing keeps the arithmetic focused on making change.
    const menu = await tx
      .insert(menuItems)
      .values([
        { name: "Coffee", priceCents: 100, category: "drink", icon: "mug", sortOrder: 1 },
        { name: "Hot chocolate", priceCents: 100, category: "drink", icon: "mug", sortOrder: 2 },
        { name: "Tea", priceCents: 100, category: "drink", icon: "tea", sortOrder: 3 },
        { name: "Decaf coffee", priceCents: 100, category: "drink", icon: "decaf", sortOrder: 4 },
        { name: "Cookie", priceCents: 100, category: "treat", icon: "cookie", isSpecial: true, sortOrder: 5 },
      ])
      .returning();

    const extras = await tx
      .insert(addons)
      .values([
        { name: "Cream", priceCents: 0, icon: "cream", sortOrder: 1 },
        { name: "Non-dairy creamer", priceCents: 0, icon: "no-dairy", sortOrder: 2 },
        { name: "Sugar", priceCents: 0, icon: "sugar", sortOrder: 3 },
        { name: "Sweetener", priceCents: 0, sortOrder: 4 },
        { name: "Vanilla syrup", priceCents: 25, icon: "syrup", sortOrder: 5 },
      ])
      .returning();

    // --- Inventory --------------------------------------------------------
    const supplies = await tx
      .insert(inventoryItems)
      .values([
        { name: "Coffee cups", unit: "cups", parLevel: 50, sortOrder: 1 },
        { name: "Lids", unit: "lids", parLevel: 50, sortOrder: 2 },
        { name: "Napkins", unit: "napkins", parLevel: 100, sortOrder: 3 },
        { name: "Stirrers", unit: "stirrers", parLevel: 100, sortOrder: 4 },
        { name: "Creamers", unit: "cups", parLevel: 40, sortOrder: 5 },
        { name: "Sugar packets", unit: "packets", parLevel: 60, sortOrder: 6 },
        { name: "Treats", unit: "treats", parLevel: 20, sortOrder: 7 },
      ])
      .returning();

    // --- Students ---------------------------------------------------------
    const studentNames = ["Maya", "Jordan", "Priya", "Eli", "Sam", "Nora"];
    const seededStudents = await tx
      .insert(students)
      .values(studentNames.map((displayName) => ({ displayName, pinHash })))
      .returning();

    // --- Teachers ---------------------------------------------------------
    const noteBank = [
      "Dairy issue, use non-dairy creamer",
      "No sugar",
      "Extra sugar",
      "Usually orders the special treat",
      "Likes the mug filled only three quarters",
      "Allergic to nuts, check the treat",
    ];

    const teacherRows = Array.from({ length: 12 }, (_, i) => {
      const first = faker.person.firstName();
      const last = faker.person.lastName();
      return {
        name: `${faker.helpers.arrayElement(["Mr.", "Mrs.", "Ms."])} ${last}`,
        email: faker.internet
          .email({ firstName: first, lastName: last, provider: "example.edu" })
          .toLowerCase(),
        room: `${100 + i}`,
        notes: faker.helpers.arrayElements(noteBank, faker.number.int({ min: 0, max: 2 })),
      };
    });

    const seededPersons = await tx
      .insert(persons)
      .values(teacherRows.map((t) => ({ name: t.name, email: t.email })))
      .returning();

    await tx.insert(teacherProfiles).values(
      seededPersons.map((p, i) => ({
        personId: p.id,
        room: teacherRows[i].room,
        notes: teacherRows[i].notes,
      })),
    );

    // --- Administrator ----------------------------------------------------
    // The first teacher is also the admin, exercising one person with two roles.
    const [adminPerson] = seededPersons;
    await tx.insert(adminUsers).values({ personId: adminPerson.id, isOwner: true });

    // --- Settings ---------------------------------------------------------
    await tx.insert(siteSettings).values({
      id: 1,
      isDemo: options.demo,
      demoResetAt: new Date(),
    });

    onSeeded?.({
      menu: menu.length,
      addons: extras.length,
      students: seededStudents.length,
      teachers: seededPersons.length,
      supplies: supplies.length,
      adminEmail: adminPerson.email,
    });
    return "seeded";
  });
}
