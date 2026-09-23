// Must come first: it populates process.env before ./index reads DATABASE_URL.
import "./load-env";

import { addAdmin } from "../lib/admins";
import { getClient } from "./index";

/**
 * Grants administrator access to an email address.
 *
 * This exists because the seed cannot be used in production: it truncates every
 * table. Without it a fresh deployment has no administrator and therefore no
 * way to create one, since the only sign-in path checks an allowlist that is
 * empty. That is a real deadlock, and a script that adds exactly one row is the
 * whole answer.
 *
 * Safe to run against production: it inserts or updates a single person and one
 * allowlist row, and destroys nothing. Point it at the direct connection, not
 * the pooler.
 *
 *   pnpm admin:add "Mrs. Rowe" rowe@school.example
 *
 * Re-running it for an existing administrator is a no-op that reports as much,
 * so it is safe to use as a check.
 */

async function main() {
  const [name, email] = process.argv.slice(2);

  if (!name || !email || !email.includes("@")) {
    console.error('Usage: pnpm admin:add "Full Name" someone@example.com');
    process.exitCode = 1;
    return;
  }

  // The same function as the Admins page, so both follow one set of rules:
  // an existing person with that address (usually a teacher who buys from the
  // cart) is reused, keeping their order history in one place.
  const result = await addAdmin({ name, email }, null);

  if (!result.ok) {
    console.log(
      result.error === "already"
        ? "Already an administrator. Nothing to do."
        : 'That does not look like a name and an email. Usage: pnpm admin:add "Full Name" someone@example.com',
    );
    if (result.error === "invalid") process.exitCode = 1;
    return;
  }

  const normalized = email.trim().toLowerCase();
  console.log(result.created ? `Created person: ${name.trim()} <${normalized}>` : `Found existing person <${normalized}>`);
  console.log(`
${normalized} can now sign in at /admin/sign-in.`);
  console.log("There is no password; a sign-in code is emailed to that address.");
  console.log("From now on, more admins can be added from the Admins page.");
}

main()
  .then(() => getClient().end())
  .catch(async (error) => {
    console.error("\nFailed:", error);
    await getClient().end();
    process.exit(1);
  });
