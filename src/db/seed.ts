// Must be first: populates process.env before ./index reads DATABASE_URL.
import "./load-env";

import { getClient } from "./index";
import { DEMO_PIN, seedDatabase } from "./seed-data";

/** `pnpm seed [--demo]`: wipes and reseeds the database. Data lives in ./seed-data.ts. */

async function main() {
  const demo = process.argv.includes("--demo");
  console.log(`Seeding${demo ? " the demo" : ""}. This wipes the current database contents.\n`);

  const result = await seedDatabase({ demo }, (s) => {
    console.log(`  ${s.menu} menu items`);
    console.log(`  ${s.addons} add-ons`);
    console.log(`  ${s.students} students`);
    console.log(`  ${s.teachers} teachers`);
    console.log(`  ${s.supplies} inventory items`);
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
