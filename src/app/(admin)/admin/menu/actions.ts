"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { addons, menuItems } from "@/db/schema";
import {
  parseMenuEdit,
  parseMenuFlag,
  parseMenuIcon,
  parseNewMenuEntry,
  type MenuKind,
} from "@/lib/validate";

import { isUniqueViolation } from "@/lib/pg-errors";
import { setCardPaymentsEnabled, type SetCardPaymentsResult } from "@/lib/settings";

import { requireAdmin } from "../require-admin";

/**
 * Menu server actions. Each calls `requireAdmin()` first: a server action is its
 * own POST endpoint and does not pass through the layout.
 *
 * Prices arrive as integer cents (the forms convert with `dollarsToCents`).
 * Editing a price affects only future sales; `order_items.unit_price_cents`
 * snapshots the price at sale time. Items are never deleted, only deactivated.
 */

export type MenuMutationResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "not_found" | "duplicate" };

/**
 * Next `sort_order` for appending, so new entries do not reshuffle the
 * student grid.
 */
async function nextSortOrder(kind: MenuKind): Promise<number> {
  // Separate branches because Drizzle's per-table builder types do not union.
  const rows =
    kind === "item"
      ? await db
          .select({
            next: sql<number>`coalesce(max(${menuItems.sortOrder}), 0)::int + 1`,
          })
          .from(menuItems)
      : await db
          .select({
            next: sql<number>`coalesce(max(${addons.sortOrder}), 0)::int + 1`,
          })
          .from(addons);

  return rows[0]?.next ?? 1;
}

export async function createMenuEntry(input: unknown): Promise<MenuMutationResult> {
  await requireAdmin();

  const parsed = parseNewMenuEntry(input);
  if (!parsed) return { ok: false, error: "invalid" };

  // Names are unique among active rows within each list (a partial unique
  // index per table). Insert and translate the violation rather than
  // check-then-insert, which would race.
  const sortOrder = await nextSortOrder(parsed.kind);

  try {
    if (parsed.kind === "item") {
      await db.insert(menuItems).values({
        name: parsed.name,
        priceCents: parsed.priceCents,
        isSpecial: parsed.isSpecial,
        sortOrder,
      });
    } else {
      // Add-ons have no `is_special` column.
      await db.insert(addons).values({
        name: parsed.name,
        priceCents: parsed.priceCents,
        sortOrder,
      });
    }
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "duplicate" };
    throw error;
  }

  revalidatePath("/admin/menu");
  return { ok: true };
}

export async function updateMenuEntry(input: unknown): Promise<MenuMutationResult> {
  await requireAdmin();

  const parsed = parseMenuEdit(input);
  if (!parsed) return { ok: false, error: "invalid" };

  const updated =
    parsed.kind === "item"
      ? await db
          .update(menuItems)
          .set({ name: parsed.name, priceCents: parsed.priceCents })
          .where(eq(menuItems.id, parsed.id))
          .returning({ id: menuItems.id })
      : await db
          .update(addons)
          .set({ name: parsed.name, priceCents: parsed.priceCents })
          .where(eq(addons.id, parsed.id))
          .returning({ id: addons.id });

  if (updated.length === 0) return { ok: false, error: "not_found" };

  revalidatePath("/admin/menu");
  return { ok: true };
}

/**
 * Soft-deletes or restores an entry. There is no hard delete: past orders
 * reference these rows.
 */
export async function setMenuEntryActive(
  input: unknown,
): Promise<MenuMutationResult> {
  await requireAdmin();

  const parsed = parseMenuFlag(input);
  if (!parsed) return { ok: false, error: "invalid" };

  const updated =
    parsed.kind === "item"
      ? await db
          .update(menuItems)
          .set({ active: parsed.value })
          .where(eq(menuItems.id, parsed.id))
          .returning({ id: menuItems.id })
      : await db
          .update(addons)
          .set({ active: parsed.value })
          .where(eq(addons.id, parsed.id))
          .returning({ id: addons.id });

  if (updated.length === 0) return { ok: false, error: "not_found" };

  revalidatePath("/admin/menu");
  return { ok: true };
}

/**
 * Sets or clears an entry's picture, from the fixed set in src/lib/menu-icons.ts
 * (also enforced by the database). See docs/adr/0015-menu-pictures.md.
 */
export async function setMenuEntryIcon(input: unknown): Promise<MenuMutationResult> {
  await requireAdmin();

  const parsed = parseMenuIcon(input);
  if (!parsed) return { ok: false, error: "invalid" };

  const updated =
    parsed.kind === "item"
      ? await db
          .update(menuItems)
          .set({ icon: parsed.icon })
          .where(eq(menuItems.id, parsed.id))
          .returning({ id: menuItems.id })
      : await db
          .update(addons)
          .set({ icon: parsed.icon })
          .where(eq(addons.id, parsed.id))
          .returning({ id: addons.id });

  if (updated.length === 0) return { ok: false, error: "not_found" };

  revalidatePath("/admin/menu");
  return { ok: true };
}

/** Sets or clears the special. At most one item can be the special. */
export async function setMenuItemSpecial(
  input: unknown,
): Promise<MenuMutationResult> {
  await requireAdmin();

  const parsed = parseMenuFlag(input);
  if (!parsed) return { ok: false, error: "invalid" };
  // Add-ons cannot be the special.
  if (parsed.kind !== "item") return { ok: false, error: "invalid" };

  // A unique index allows only one special, so choosing a new one replaces the
  // old one within a single transaction.
  const updated = await db.transaction(async (tx) => {
    if (parsed.value) {
      await tx
        .update(menuItems)
        .set({ isSpecial: false })
        .where(eq(menuItems.isSpecial, true));
    }

    return tx
      .update(menuItems)
      .set({ isSpecial: parsed.value })
      .where(eq(menuItems.id, parsed.id))
      .returning({ id: menuItems.id });
  });

  if (updated.length === 0) return { ok: false, error: "not_found" };

  revalidatePath("/admin/menu");
  return { ok: true };
}

/** Turns staff card payments on or off for the whole cart (3.7). */
export async function saveCardPayments(enabled: unknown): Promise<SetCardPaymentsResult> {
  const admin = await requireAdmin();
  const result = await setCardPaymentsEnabled(enabled, admin.personId);
  if (result.ok) {
    revalidatePath("/admin/menu");
    revalidatePath("/shift/order");
  }
  return result;
}
