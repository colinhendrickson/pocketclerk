import Link from "next/link";

import { ThemeColor } from "@/app/theme-color";
import { Logo } from "@/components";
import { branding } from "@/lib/branding";
import { PRODUCT_NAME } from "@/lib/site-mode";
import { getAdmin } from "@/lib/admin-auth";

import { TourButton } from "./_help/tour";
import { ADMIN_DRAWER_ID, AdminMenuButton, AdminNav } from "./admin-nav";

/**
 * Admin shell. Signed out (the sign-in page), it renders without navigation;
 * pages still enforce auth themselves via `requireAdmin`.
 *
 * Denser than the student side: the audience is staff, not students on a
 * locked iPad. Navigation is a daisyUI drawer (DESIGN.md §3): a persistent
 * sidebar at xl and up, behind a menu button below that.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdmin();

  // Signed out, show only the product name so the page reveals nothing about
  // the school.
  const title = (
    <Link href="/admin" className="flex min-w-0 items-center gap-2 text-lg font-extrabold sm:text-xl">
      <Logo size={28} />
      <span className="truncate">
        {admin ? branding.cartName : PRODUCT_NAME}
        <span className="ml-2 hidden text-sm font-bold opacity-75 sm:inline">admin</span>
      </span>
    </Link>
  );

  if (!admin) {
    return (
      <div className="flex min-h-full flex-1 flex-col bg-base-200 text-base-content">
        <ThemeColor />
        <header className="navbar border-b border-base-300 bg-base-100 px-4 md:px-6">
          {title}
        </header>
        {children}
      </div>
    );
  }

  return (
    <div className="drawer min-h-full flex-1 bg-base-200 text-base-content xl:drawer-open">
      <ThemeColor />
      {/* Drawer state; hidden from assistive tech because the menu button
          reports it. */}
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
        {/* Pointer-only close target; keyboard users press Escape. */}
        <label htmlFor={ADMIN_DRAWER_ID} aria-hidden="true" className="drawer-overlay" />
        <AdminNav />
      </div>
    </div>
  );
}

