import { readdirSync } from "node:fs";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { getClient } from "@/db";
import { EXPECTED_MIGRATIONS, migrationStatus } from "@/lib/migration-status";

import journal from "../drizzle/meta/_journal.json";

/**
 * The migration journal and the migration files must agree.
 *
 * drizzle-kit applies what the journal lists, not what is in the folder. A
 * hand-written migration with no journal entry is skipped, and `migrate` still
 * reports success: this project shipped one that way, and the column it added
 * existed nowhere but the developer's own database. The first test here fails
 * on that mistake before anything is deployed.
 */

const DRIZZLE_DIR = path.resolve(__dirname, "../drizzle");

describe("the migration journal", () => {
  const files = readdirSync(DRIZZLE_DIR)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => name.replace(/\.sql$/, ""))
    .sort();
  const tags = journal.entries.map((entry) => entry.tag).sort();

  it("lists every migration file", () => {
    const unlisted = files.filter((file) => !tags.includes(file));
    expect(unlisted, "these files will never be applied").toEqual([]);
  });

  it("has a file for every entry", () => {
    const missing = tags.filter((tag) => !files.includes(tag));
    expect(missing, "these entries point at nothing").toEqual([]);
  });

  it("numbers entries in order with no gaps", () => {
    expect(journal.entries.map((entry) => entry.idx)).toEqual(
      journal.entries.map((_, i) => i),
    );
  });

  it("orders entries by timestamp, which is how drizzle decides what is new", () => {
    const whens = journal.entries.map((entry) => entry.when);
    expect([...whens].sort((a, b) => a - b)).toEqual(whens);
  });
});

describe("migrationStatus", () => {
  afterAll(async () => {
    await getClient().end();
  });

  it("reports the test database as current", async () => {
    // The test database is migrated before the suite runs, locally and in CI.
    expect(await migrationStatus()).toEqual({
      state: "current",
      applied: EXPECTED_MIGRATIONS,
      expected: EXPECTED_MIGRATIONS,
    });
  });
});
