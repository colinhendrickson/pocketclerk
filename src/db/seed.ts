// Must come first: it populates process.env before ./index reads DATABASE_URL.
import "./load-env";

import { faker } from "@faker-js/faker";

import { hashPin } from "../lib/auth";
import { sql } from "drizzle-orm";

import { db, getClient } from "./index";
import {
  addons,
  inventoryItems,
  menuItems,
  persons,
  students,
  teacherProfiles,
} from "./schema";

/**
 * Development and demo seed.
 *
 * This script is the privacy boundary. Every name, room and email below is
 * generated, and real people only ever enter the system through the admin UI on
 * a private deployment. Nothing in this repository should ever be replaced with
 * real school data, and `pnpm seed` is safe to run against a demo database on
 * purpose.
 *
 * The faker seed is fixed so screenshots and tests are reproducible.
 */

faker.seed(20260903);

/** Shared demo PIN. Printed at the end so you can actually sign in. */
const DEMO_PIN = "1234";

async function main() {
  console.log("Seeding. This wipes the current database contents.\n");

  // Order matters: children before parents.
  await db.execute(
    sql`TRUNCATE order_item_addons, order_items, receipt_jobs, orders,
        inventory_counts, inventory_items, shifts, students, teacher_profiles,
        admin_users, persons, menu_items, addons
        RESTART IDENTITY CASCADE`,
  );

  // --- Menu ---------------------------------------------------------------
  // Everything is a dollar. That is the program's actual pricing, and it is
  // deliberate: a single price keeps the mental arithmetic on making change
  // rather than on adding up varied prices.
  const menu = await db
    .insert(menuItems)
    .values([
      { name: "Coffee", priceCents: 100, category: "drink", sortOrder: 1 },
      { name: "Hot chocolate", priceCents: 100, category: "drink", sortOrder: 2 },
      { name: "Tea", priceCents: 100, category: "drink", sortOrder: 3 },
      { name: "Decaf coffee", priceCents: 100, category: "drink", sortOrder: 4 },
      {
        name: "Cookie",
        priceCents: 100,
        category: "treat",
        isSpecial: true,
        sortOrder: 5,
      },
    ])
    .returning();

  // Free add-ons must not move the total; that rule is enforced by the money
  // module and exercised by the seed having several of them.
  const extras = await db
    .insert(addons)
    .values([
      { name: "Cream", priceCents: 0, sortOrder: 1 },
      { name: "Non-dairy creamer", priceCents: 0, sortOrder: 2 },
      { name: "Sugar", priceCents: 0, sortOrder: 3 },
      { name: "Sweetener", priceCents: 0, sortOrder: 4 },
      { name: "Vanilla syrup", priceCents: 25, sortOrder: 5 },
    ])
    .returning();

  // --- Inventory ----------------------------------------------------------
  // Supplies, not menu items: what the cart consumes rather than what it sells.
  // Par levels are the quantity a full cart carries.
  const supplies = await db
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

  // --- Students -----------------------------------------------------------
  const pinHash = await hashPin(DEMO_PIN);
  const studentNames = ["Maya", "Jordan", "Priya", "Eli", "Sam", "Nora"];
  const seededStudents = await db
    .insert(students)
    .values(studentNames.map((displayName) => ({ displayName, pinHash })))
    .returning();

  // --- Teachers -----------------------------------------------------------
  // Notes are the "customer memory" teaching goal: the student sees these above
  // the menu before every order, so the interface enforces the lesson.
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

  const seededPersons = await db
    .insert(persons)
    .values(teacherRows.map((t) => ({ name: t.name, email: t.email })))
    .returning();

  await db.insert(teacherProfiles).values(
    seededPersons.map((p, i) => ({
      personId: p.id,
      room: teacherRows[i].room,
      notes: teacherRows[i].notes,
    })),
  );

  console.log(`  ${menu.length} menu items`);
  console.log(`  ${extras.length} add-ons`);
  console.log(`  ${seededStudents.length} students`);
  console.log(`  ${seededPersons.length} teachers`);
  console.log(`  ${supplies.length} inventory items`);
  console.log(`\nDone. Every student's PIN is ${DEMO_PIN}.`);
}

main()
  .then(() => getClient().end())
  .catch(async (error) => {
    console.error("\nSeed failed:", error);
    await getClient().end();
    process.exit(1);
  });
