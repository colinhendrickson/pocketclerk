import Link from "next/link";

import { branding } from "@/lib/branding";
import { getAdmin } from "@/lib/admin-auth";

import { TourButton } from "./_help/tour";
import { ADMIN_DRAWER_ID, AdminMenuButton, AdminNav } from "./admin-nav";

/**
 * Admin shell and auth guard.
 *
 * Every admin page is behind this layout, so the session check happens once and
 * cannot be forgotten on a new page. The sign-in route is the exception and
 * renders its own page without the shell.
 *
 * Denser type than the student side on purpose: the audience is one adult
 * rather than a student on a locked iPad, and the accessibility constraints
 * that shape the cart do not apply here.
 *
 * Per DESIGN.md §3 the navigation is a daisyUI drawer: a persistent sidebar at
 * xl and up, and behind a menu button below that, so six links and Sign out
 * never have to share one row on a phone.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdmin();

  const title = (
    <Link href="/admin" className="min-w-0 truncate text-xl font-extrabold">
      {branding.cartName}
      <span className="ml-2 text-sm font-bold opacity-75">admin</span>
    </Link>
  );

  if (!admin) {
    return (
      <div className="flex min-h-full flex-1 flex-col bg-base-200 text-base-content">
        <header className="navbar border-b border-base-300 bg-base-100 px-4 md:px-6">
          {title}
        </header>
        {children}
      </div>
    );
  }

  return (
    <div className="drawer min-h-full flex-1 bg-base-200 text-base-content xl:drawer-open">
      {/* The drawer's state. Hidden from assistive technology: the menu
          button in the header is the control, and it reports this state. */}
      <input
        id={ADMIN_DRAWER_ID}
        type="checkbox"
        className="drawer-toggle"
        tabIndex={-1}
        aria-hidden="true"
      />
      <div className="drawer-content flex min-w-0 flex-col">
        <header className="navbar gap-2 border-b border-base-300 bg-base-100 px-4 md:px-6">
          <AdminMenuButton />
          {title}
          <div className="ml-auto">
            <TourButton />
          </div>
        </header>
        {children}
      </div>
      <div className="drawer-side z-20">
        {/* Tapping outside the menu closes it. Keyboard users close it with
            Escape, so this is for pointers only. */}
        <label htmlFor={ADMIN_DRAWER_ID} aria-hidden="true" className="drawer-overlay" />
        <AdminNav />
      </div>
    </div>
  );
}

