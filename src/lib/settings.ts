import { eq } from "drizzle-orm";

import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { checkPrimary, normalizeHex } from "@/lib/colors";

/**
 * The deployment's main color, or null for the theme's own. Read on every
 * page, so errors fall back to the theme rather than failing the page.
 */
export async function getPrimaryColor(): Promise<string | null> {
  try {
    const [row] = await db
      .select({ primaryColor: siteSettings.primaryColor })
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
      .limit(1);
    return row?.primaryColor ?? null;
  } catch (error) {
    console.error("[settings] could not read the main color; using the theme's own", error);
    return null;
  }
}

export type SetPrimaryColorResult =
  | { ok: true; color: string | null }
  | { ok: false; error: "invalid" | "unreadable"; suggestion?: string | null };

/**
 * Saves the main color, or clears it with null. The contrast check is enforced
 * here because Server Actions are open endpoints; a failing color is refused
 * with a darker suggestion that passes.
 */
export async function setPrimaryColor(input: unknown, by: string): Promise<SetPrimaryColorResult> {
  let color: string | null = null;
  if (input !== null) {
    color = normalizeHex(input);
    if (!color) return { ok: false, error: "invalid" };
    const check = checkPrimary(color);
    if (!check.ok) return { ok: false, error: "unreadable", suggestion: check.suggestion };
  }

  await db
    .insert(siteSettings)
    .values({ id: 1, primaryColor: color, updatedBy: by, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: siteSettings.id,
      set: { primaryColor: color, updatedBy: by, updatedAt: new Date() },
    });
  return { ok: true, color };
}
