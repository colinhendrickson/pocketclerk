"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { addons, menuItems } from "@/db/schema";
import {
  parseMenuEdit,
  parseMenuFlag,
  parseNewMenuEntry,
  type MenuKind,
} from "@/lib/validate";

import { isUniqueViolation } from "@/lib/pg-errors";

import { requireAdmin } from "../require-admin";

/**
 * Server actions for the menu.
 *
 * `requireAdmin()` runs first in each one, because each is its own POST
 * endpoint and the layout that renders the page is not in the request path.
 *
 * Every price crossing this boundary is already integer cents: the forms call
 * `dollarsToCents` on what was typed, and these signatures accept nothing else.
 * The dollar figure exists only as the string in the input box.
 *
 * Editing a price never rewrites history. `order_items.unit_price_cents` is a
 * snapshot taken at the moment of sale, so yesterday's receipts still say what
 * was actually charged; a change here applies to the next cup sold and nothing
 * before it.
 */

export type MenuMutationResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "not_found" | "duplicate" };

/**
 * New rows go to the end of the list.
 *
 * `sort_order` is what the student screen orders the grid by, and the
 * administrator has no drag handle here. Appending means a new item shows up in
 * a predictable place instead of landing in the middle of a layout the students
 * have learned.
 */
async function nextSortOrder(kind: MenuKind): Promise<number> {
  // The two branches are spelled out rather than selecting from a
  // `menuItems | addons` union. Drizzle's builder types are per-table, so the
  // union collapses to something unusable and would have to be cast away.
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

  // A menu with two rows reading "Hot chocolate" is a menu the student has to
  // guess at, so the same name is refused within its own list. The two lists
  // are separate: "Whipped cream" can reasonably be both a treat you buy and an
  // extra you add, and each has its own partial unique index.
  //
  // The index is the authority. Checking first and inserting second leaves a
  // gap two requests can both pass, so the insert is attempted and its refusal
  // is translated.
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
      // Add-ons have no `is_special`; the flag is dropped rather than faked.
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
 * Switching an item off is how it leaves the menu. There is no delete: past
 * orders reference the row, and a free add-on that was on the cart last spring
 * is part of how last spring's sales are explained.
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
 * The rotating special.
 *
 * Deliberately not exclusive: the schema allows several items to be flagged at
 * once, and a week with two treats is a real thing. Enforcing "only one" here
 * would be a rule the database does not hold, which is exactly the kind of
 * invariant that drifts once anything else writes the column.
 */
export async function setMenuItemSpecial(
  input: unknown,
): Promise<MenuMutationResult> {
  await requireAdmin();

  const parsed = parseMenuFlag(input);
  if (!parsed) return { ok: false, error: "invalid" };
  // Add-ons have no such column, so a payload claiming one is malformed rather
  // than a no-op worth pretending succeeded.
  if (parsed.kind !== "item") return { ok: false, error: "invalid" };

  // "Today's special treat" is singular, and the database now enforces that
  // with a unique index. Choosing a new one therefore means replacing the old
  // one rather than reporting a conflict: clearing and setting happen in one
  // transaction so the pair is never briefly empty or briefly two.
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
