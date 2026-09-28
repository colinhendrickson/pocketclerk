import { sql } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { db, getClient } from "@/db";
import { cardPaymentsEnabled, setCardPaymentsEnabled } from "@/lib/settings";

/** The switch that lets teachers pay with a staff card (3.7). Off until staff turn it on. */

afterEach(async () => {
  await db.execute(sql`UPDATE site_settings SET card_payments_enabled = false`);
});

afterAll(async () => {
  await getClient().end();
});

describe("staff card payments", () => {
  it("are off until staff turn them on", async () => {
    expect(await cardPaymentsEnabled()).toBe(false);
  });

  it("can be turned on and off", async () => {
    const [admin] = await db.execute<{ person_id: string }>(sql`SELECT person_id FROM admin_users LIMIT 1`);
    expect(await setCardPaymentsEnabled(true, admin.person_id)).toEqual({ ok: true });
    expect(await cardPaymentsEnabled()).toBe(true);
    expect(await setCardPaymentsEnabled(false, admin.person_id)).toEqual({ ok: true });
    expect(await cardPaymentsEnabled()).toBe(false);
  });

  it("refuses anything but true or false", async () => {
    expect(await setCardPaymentsEnabled("yes", "x")).toEqual({ ok: false, error: "invalid" });
  });
});
