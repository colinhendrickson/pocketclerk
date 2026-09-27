import { listSuppliesForAdmin } from "@/lib/admin-queries";

import { HelpPanel } from "../_help/help-panel";
import { requireAdmin } from "../require-admin";
import { SupplyList } from "./supply-list";

export const dynamic = "force-dynamic";

/** The supplies students count at the end of each shift. */
export default async function AdminInventoryPage() {
  await requireAdmin();
  const supplies = await listSuppliesForAdmin();

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-8 p-4 md:p-6">
      <header className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-extrabold">Inventory</h1>
        <p className="opacity-70">
          The supplies the cart carries. At the end of each shift, the student counts what is
          left of each one, and the cart works out what was used and what to restock.
        </p>
      </header>

      <HelpPanel route="/admin/inventory" />

      <SupplyList supplies={supplies} />
    </main>
  );
}
