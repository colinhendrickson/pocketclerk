import Link from "next/link";

import { branding } from "@/lib/branding";
import { getAdmin } from "@/lib/admin-auth";

import { signOut } from "./actions";

/**
 * Admin shell and auth guard.
 *
 * Every admin page is behind this layout, so the session check happens once and
 * cannot be forgotten on a new page. The sign-in route is the exception and
 * renders its own page without the shell.
 *
 * Denser type than the student side on purpose: the audience is one adult on a
 * laptop rather than a student on a locked iPad, and the accessibility
 * constraints that shape the cart do not apply here.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdmin();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-base-200 text-base-content">
      <header className="navbar border-b border-base-300 bg-base-100 px-6">
        <Link href="/admin" className="flex-1 text-xl font-extrabold">
          {branding.cartName}
          <span className="ml-2 text-sm font-bold opacity-60">admin</span>
        </Link>
        {admin ? (
          <nav className="flex items-center gap-2">
            <Link href="/admin/students" className="btn btn-ghost btn-sm">
              Students
            </Link>
            <Link href="/admin/teachers" className="btn btn-ghost btn-sm">
              Teachers
            </Link>
            <Link href="/admin/menu" className="btn btn-ghost btn-sm">
              Menu
            </Link>
            <Link href="/admin/orders" className="btn btn-ghost btn-sm">
              Orders
            </Link>
            <Link href="/admin/receipts" className="btn btn-ghost btn-sm">
              Receipts
            </Link>
            <form action={signOut}>
              <button type="submit" className="btn btn-outline btn-sm">
                Sign out
              </button>
            </form>
          </nav>
        ) : null}
      </header>
      {children}
    </div>
  );
}

