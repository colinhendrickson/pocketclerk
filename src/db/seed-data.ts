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
 * The seed: a whole cart of made-up people, used for development, the tests,
 * and the public demo, which puts it back every hour.
 *
 * This is the privacy boundary. Every name, room and email below is generated,
 * and real people only ever enter the system through the admin UI on a school's
 * own copy. Nothing here should ever be replaced with real school data.
 *
 * The faker seed is fixed so screenshots and tests are reproducible.
 */

/** Shared PIN for every seeded student. */
export const DEMO_PIN = "1234";

/**
 * Advisory lock key for a seed in progress. Two resets can start together on
 * the demo (two visitors after the hour, on two servers); the second sees the
 * lock taken and skips rather than wiping the first one's work half way.
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
 * Wipes the cart's data and seeds it again, in one transaction: anyone reading
 * during a reset sees the old cart or the new one, never half of either.
 *
 * `demo` marks the database as the public demo's; see `isDemo` in
 * src/lib/demo.ts. Returns "busy" without touching anything if another seed
 * holds the lock.
 */
export async function seedDatabase(
  options: { demo: boolean },
  onSeeded?: (summary: SeedSummary) => void,
): Promise<SeedResult> {
  faker.seed(20260903);
  // Hashed before the transaction opens, so the lock is held for as short a
  // time as possible.
  const pinHash = await hashPin(DEMO_PIN);

  return db.transaction(async (tx) => {
    const [lock] = await tx.execute<{ locked: boolean }>(
      sql`SELECT pg_try_advisory_xact_lock(${SEED_LOCK}) AS locked`,
    );
    if (!lock.locked) return "busy";

    // Truncating persons cascades to site_settings, whose updated_by points at
    // it, so the settings row is written again below.
    await tx.execute(
      sql`TRUNCATE order_item_addons, order_items, receipt_jobs, orders,
          inventory_counts, inventory_items, shifts, students, teacher_profiles,
          admin_users, persons, menu_items, addons, site_settings
          RESTART IDENTITY CASCADE`,
    );

    // --- Menu -------------------------------------------------------------
    // Everything is a dollar. That is the program's actual pricing, and it is
    // deliberate: a single price keeps the mental arithmetic on making change
    // rather than on adding up varied prices.
    const menu = await tx
      .insert(menuItems)
      .values([
        { name: "Coffee", priceCents: 100, category: "drink", sortOrder: 1 },
        { name: "Hot chocolate", priceCents: 100, category: "drink", sortOrder: 2 },
        { name: "Tea", priceCents: 100, category: "drink", sortOrder: 3 },
        { name: "Decaf coffee", priceCents: 100, category: "drink", sortOrder: 4 },
        { name: "Cookie", priceCents: 100, category: "treat", isSpecial: true, sortOrder: 5 },
      ])
      .returning();

    // Free add-ons must not move the total; that rule is enforced by the money
    // module and exercised by the seed having several of them.
    const extras = await tx
      .insert(addons)
      .values([
        { name: "Cream", priceCents: 0, sortOrder: 1 },
        { name: "Non-dairy creamer", priceCents: 0, sortOrder: 2 },
        { name: "Sugar", priceCents: 0, sortOrder: 3 },
        { name: "Sweetener", priceCents: 0, sortOrder: 4 },
        { name: "Vanilla syrup", priceCents: 25, sortOrder: 5 },
      ])
      .returning();

    // --- Inventory --------------------------------------------------------
    // Supplies, not menu items: what the cart consumes rather than what it
    // sells. Par levels are the quantity a full cart carries.
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
    // Notes are the "customer memory" teaching goal: the student sees these
    // above the menu before every order, so the interface enforces the lesson.
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
    // The first teacher is also the administrator, which exercises the "one
    // person, two roles" shape the schema was built around: she buys coffee
    // and she manages the cart, and revoking one does not touch the other.
    const [adminPerson] = seededPersons;
    await tx.insert(adminUsers).values({ personId: adminPerson.id });

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
