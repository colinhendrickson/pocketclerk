import { listAddonsForAdmin, listMenuForAdmin } from "@/lib/admin-queries";

import { requireAdmin } from "../require-admin";
import { MenuSection, type MenuEntryView } from "./menu-section";

export const dynamic = "force-dynamic";

/**
 * The menu: what the cart sells and what can be added to it.
 *
 * Two lists rather than one, because they are two different things. A menu item
 * is something a teacher buys; an add-on is something done to it, and is often
 * free. Merging them would mean a "price 0, not orderable on its own" flag,
 * which is a worse version of having two tables.
 *
 * Every price shown here is read from integer cents and formatted at this edge.
 * Editing one takes dollars in the form and converts before anything is sent.
 */
export default async function AdminMenuPage() {
  await requireAdmin();

  const [items, extras] = await Promise.all([
    listMenuForAdmin(),
    listAddonsForAdmin(),
  ]);

  const itemViews: MenuEntryView[] = items.map((item) => ({
    id: item.id,
    name: item.name,
    priceCents: item.priceCents,
    active: item.active,
    isSpecial: item.isSpecial,
  }));

  /** Add-ons have no `is_special` column, so the flag is explicitly absent. */
  const addonViews: MenuEntryView[] = extras.map((addon) => ({
    id: addon.id,
    name: addon.name,
    priceCents: addon.priceCents,
    active: addon.active,
    isSpecial: null,
  }));

  return (
    <main className="flex flex-1 flex-col gap-8 p-6">
      <header className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-extrabold">Menu</h1>
        <p className="opacity-70">
          Taking something off the menu hides it from the cart and keeps every
          past order intact. Changing a price applies to the next sale, never to
          a receipt already given out.
        </p>
      </header>

      <MenuSection
        kind="item"
        title="Menu items"
        description="What a teacher can order. Mark the treat of the week as the special."
        addLabel="Add item"
        rows={itemViews}
      />

      <MenuSection
        kind="addon"
        title="Add-ons"
        description="Extras a student adds to a drink. A free extra is priced at 0.00 and must not move the total."
        addLabel="Add add-on"
        rows={addonViews}
      />
    </main>
  );
}
