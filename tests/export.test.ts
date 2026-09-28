import { afterAll, describe, expect, it } from "vitest";

import { getClient } from "@/db";
import { EXPORT_TABLES, exportAllData } from "@/lib/export";

/**
 * "Export everything" is the school's backup, since free-plan database backups
 * cannot be downloaded. It must be complete, and must never contain secrets.
 */

afterAll(async () => {
  await getClient().end();
});

describe("exportAllData", () => {
  it("includes every table of school data", async () => {
    const file = await exportAllData();
    expect(Object.keys(file.tables).sort()).toEqual([...EXPORT_TABLES].sort());
    expect(file.tables.students.length).toBeGreaterThan(0);
    expect(file.tables.menu_items.length).toBeGreaterThan(0);
    expect(file.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("leaves out PINs, lockouts and sign-in secrets", async () => {
    const file = await exportAllData();
    const text = JSON.stringify(file);
    expect(text).not.toMatch(/pin_hash|failed_attempts|locked_until|token_hash|code_hash/);
    expect(file.tables).not.toHaveProperty("admin_login_tokens");
  });
});
