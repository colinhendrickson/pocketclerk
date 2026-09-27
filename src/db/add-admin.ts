// Must be first: populates process.env before ./index reads DATABASE_URL.
import "./load-env";

import { addAdmin } from "../lib/admins";
import { getClient } from "./index";

/**
 * Grants admin access to an email address, bootstrapping the first admin on a
 * fresh deployment (the seed truncates, so it cannot be used in production).
 * Non-destructive and idempotent. Use the direct connection, not the pooler.
 *
 *   pnpm admin:add "Full Name" someone@example.com
 */

async function main() {
  const [name, email] = process.argv.slice(2);

  if (!name || !email || !email.includes("@")) {
    console.error('Usage: pnpm admin:add "Full Name" someone@example.com');
    process.exitCode = 1;
    return;
  }

  // Shared with the Admins page: an existing person with this email is reused.
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
