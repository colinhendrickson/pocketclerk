import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * "Export everything": every table of school data as JSON, for staff to keep as
 * a backup (free-plan database backups cannot be downloaded). PIN hashes,
 * lockout state and sign-in tokens are never included.
 */

export const EXPORT_TABLES = [
  "persons",
  "teacher_profiles",
  "admin_users",
  "students",
  "shifts",
  "menu_items",
  "addons",
  "orders",
  "order_items",
  "order_item_addons",
  "inventory_items",
  "inventory_counts",
  "receipt_jobs",
  "site_settings",
] as const;

export type ExportTable = (typeof EXPORT_TABLES)[number];

/** Columns that are secrets or security state, removed from every row. */
const EXCLUDED_COLUMNS = new Set(["pin_hash", "failed_attempts", "locked_until"]);

export interface ExportFile {
  exportedAt: string;
  tables: Record<ExportTable, Record<string, unknown>[]>;
}

export async function exportAllData(): Promise<ExportFile> {
  const tables = {} as ExportFile["tables"];
  for (const table of EXPORT_TABLES) {
    // Table names come from the constant list above, never from input.
    const rows = await db.execute<Record<string, unknown>>(sql.raw(`SELECT * FROM "${table}"`));
    tables[table] = rows.map((row) =>
      Object.fromEntries(Object.entries(row).filter(([column]) => !EXCLUDED_COLUMNS.has(column))),
    );
  }
  return { exportedAt: new Date().toISOString(), tables };
}
