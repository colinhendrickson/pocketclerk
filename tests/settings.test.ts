import { sql } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { db, getClient } from "@/db";
import { getPrimaryColor, setPrimaryColor } from "@/lib/settings";

/**
 * The main colour, saved and read back through the real table.
 */

let admin: string;

afterEach(async () => {
  await db.execute(sql`UPDATE site_settings SET primary_color = NULL, updated_by = NULL`);
});

afterAll(async () => {
  await getClient().end();
});

async function anAdmin() {
  if (admin) return admin;
  const [row] = await db.execute<{ person_id: string }>(sql`SELECT person_id FROM admin_users LIMIT 1`);
  admin = row.person_id;
  return admin;
}

describe("the main colour", () => {
  it("is the theme's own until someone sets one", async () => {
    expect(await getPrimaryColor()).toBeNull();
  });

  it("saves in one form and reads back", async () => {
    expect(await setPrimaryColor("#1D4ED8", await anAdmin())).toEqual({ ok: true, color: "#1d4ed8" });
    expect(await getPrimaryColor()).toBe("#1d4ed8");
  });

  it("goes back to the original when cleared", async () => {
    await setPrimaryColor("#1e3a8a", await anAdmin());
    expect(await setPrimaryColor(null, await anAdmin())).toEqual({ ok: true, color: null });
    expect(await getPrimaryColor()).toBeNull();
  });

  it("refuses a colour too light to read, with a shade that would pass", async () => {
    const result = await setPrimaryColor("#93c5fd", await anAdmin());
    expect(result).toMatchObject({ ok: false, error: "unreadable" });
    expect(result.ok === false && result.suggestion).toMatch(/^#[0-9a-f]{6}$/);
    expect(await getPrimaryColor()).toBeNull();
  });

  it("refuses something that is not a colour", async () => {
    expect(await setPrimaryColor("blue", await anAdmin())).toEqual({ ok: false, error: "invalid" });
  });
});
