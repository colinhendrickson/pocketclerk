// Must come first: it populates process.env before ./index reads DATABASE_URL.
import "./load-env";

import { getClient } from "./index";
import { DEMO_PIN, seedDatabase } from "./seed-data";

/**
 * `pnpm seed` wipes the database and fills it with a made-up cart.
 * `pnpm seed --demo` does the same and marks it as the public demo's database.
 * The data itself lives in ./seed-data.ts, which the demo's reset also uses.
 */

async function main() {
  const demo = process.argv.includes("--demo");
  console.log(`Seeding${demo ? " the demo" : ""}. This wipes the current database contents.\n`);

  const result = await seedDatabase({ demo }, (s) => {
    console.log(`  ${s.menu} menu items`);
    console.log(`  ${s.addons} add-ons`);
    console.log(`  ${s.students} students`);
    console.log(`  ${s.teachers} teachers`);
    console.log(`  ${s.supplies} inventory items`);
    // Without an email key the sign-in code is printed by the dev server, so
    // this address is all a new contributor needs to reach the admin side.
    console.log(`\nAdministrator: sign in at /admin/sign-in as ${s.adminEmail}.`);
    console.log("With no RESEND_API_KEY, the code appears in the dev server's output.");
  });

  if (result === "busy") {
    throw new Error("Another seed is running against this database. Try again in a moment.");
  }
  console.log(`\nDone. Every student's PIN is ${DEMO_PIN}.`);
}

main()
  .then(() => getClient().end())
  .catch(async (error) => {
    console.error("\nSeed failed:", error);
    await getClient().end();
    process.exit(1);
  });
