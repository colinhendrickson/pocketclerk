import { getPrimaryColor } from "@/lib/settings";

import { HelpPanel } from "../_help/help-panel";
import { requireAdmin } from "../require-admin";
import { ColorPicker } from "./color-picker";

export const dynamic = "force-dynamic";

/**
 * The site's main color, chosen by staff and stored in the database so school
 * colors never enter the repo. See docs/adr/0011-staff-chosen-main-color.md.
 */
export default async function AdminColorsPage() {
  await requireAdmin();
  const saved = await getPrimaryColor();

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold">Colors</h1>
        <p className="max-w-prose opacity-75">
          The main color of buttons and highlights on every page, including the cart. The
          background and everything else stay as they are.
        </p>
      </header>

      <HelpPanel route="/admin/colors" />

      <ColorPicker saved={saved} />
    </main>
  );
}
