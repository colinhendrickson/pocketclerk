// Must come first: it populates process.env before ./index reads DATABASE_URL.
import "./load-env";

import { eq, sql } from "drizzle-orm";

import { adminUsers, persons } from "./schema";
import { db, getClient } from "./index";

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

  const normalized = email.trim().toLowerCase();

  // The administrator is very often already a teacher, because she buys coffee
  // from the cart she runs. Reusing that row is the point of modelling people
  // separately from their roles: she keeps one order history either way.
  const [existing] = await db
    .select({ id: persons.id, name: persons.name })
    .from(persons)
    .where(sql`lower(${persons.email}) = ${normalized}`)
    .limit(1);

  let personId: string;

  if (existing) {
    personId = existing.id;
    console.log(`Found existing person: ${existing.name} <${normalized}>`);
  } else {
    const [created] = await db
      .insert(persons)
      .values({ name: name.trim(), email: normalized })
      .returning({ id: persons.id });
    personId = created.id;
    console.log(`Created person: ${name.trim()} <${normalized}>`);
  }

  const [already] = await db
    .select({ personId: adminUsers.personId })
    .from(adminUsers)
    .where(eq(adminUsers.personId, personId))
    .limit(1);

  if (already) {
    console.log("Already an administrator. Nothing to do.");
    return;
  }

  await db.insert(adminUsers).values({ personId });
  console.log(`\n${normalized} can now sign in at /admin/sign-in.`);
  console.log("There is no password; the address receives a single-use link.");
}

main()
  .then(() => getClient().end())
  .catch(async (error) => {
    console.error("\nFailed:", error);
    await getClient().end();
    process.exit(1);
  });
