import { listAdmins } from "@/lib/admins";
import { cartFormatter } from "@/lib/time";

import { requireAdmin } from "../require-admin";
import { AdminAccess, type AdminView } from "./admin-access";
import { HelpPanel } from "../_help/help-panel";

export const dynamic = "force-dynamic";

/**
 * Admin allowlist. Access is an email address on this list; there are no
 * passwords, and signing in emails a code.
 */
export default async function AdminAdminsPage() {
  const me = await requireAdmin();
  const admins = await listAdmins();
  const formatter = cartFormatter({ month: "short", day: "numeric", year: "numeric" });

  const views: AdminView[] = admins.map((admin) => ({
    personId: admin.personId,
    name: admin.name,
    email: admin.email,
    addedByName: admin.addedByName,
    since: formatter.format(admin.since),
  }));

  const signInUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/admin/sign-in`;

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold">Admins</h1>
        <p className="max-w-prose opacity-70">
          Everyone here can sign in to this admin side. There are no passwords:
          they sign in with a code emailed to the address below.
        </p>
      </header>

      <HelpPanel route="/admin/admins" />

      <AdminAccess admins={views} meId={me.personId} signInUrl={signInUrl} />
    </main>
  );
}
