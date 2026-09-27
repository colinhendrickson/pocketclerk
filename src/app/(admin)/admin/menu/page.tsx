import { listAddonsForAdmin, listMenuForAdmin } from "@/lib/admin-queries";

import { requireAdmin } from "../require-admin";
import { MenuSection, type MenuEntryView } from "./menu-section";
import { HelpPanel } from "../_help/help-panel";

export const dynamic = "force-dynamic";

/**
 * Menu items and add-ons, as two lists backed by two tables: an item is bought
 * on its own, an add-on only modifies an item and is often free.
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
    icon: item.icon,
    isSpecial: item.isSpecial,
  }));

  // Add-ons have no `is_special` column.
  const addonViews: MenuEntryView[] = extras.map((addon) => ({
    id: addon.id,
    name: addon.name,
    priceCents: addon.priceCents,
    active: addon.active,
    icon: addon.icon,
    isSpecial: null,
  }));

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-8 p-4 md:p-6">
      <header className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-extrabold">Menu</h1>
        <p className="opacity-70">
          Taking something off the menu hides it from the cart and keeps every
          past order intact. Changing a price applies to the next sale, never to
          a receipt already given out.
        </p>
      </header>

      <HelpPanel route="/admin/menu" />

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
