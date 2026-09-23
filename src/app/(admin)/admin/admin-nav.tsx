"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "./actions";

/** The id of the drawer's checkbox, shared with the hamburger in the layout. */
export const ADMIN_DRAWER_ID = "admin-drawer";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/students", label: "Students" },
  { href: "/admin/teachers", label: "Teachers" },
  { href: "/admin/menu", label: "Menu" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/receipts", label: "Receipts" },
] as const;

/**
 * The admin sidebar's contents.
 *
 * A client component for two reasons: it marks the page you are on, which needs
 * the current path, and it closes the drawer after a link is tapped. The layout
 * survives client-side navigation, so on a phone the drawer would otherwise stay
 * open over the page it just navigated to.
 */
export function AdminNav() {
  const pathname = usePathname();

  function closeDrawer() {
    const toggle = document.getElementById(ADMIN_DRAWER_ID);
    if (toggle instanceof HTMLInputElement) toggle.checked = false;
  }

  return (
    <nav className="flex min-h-full w-64 flex-col gap-4 border-r border-base-300 bg-base-100 p-4">
      <ul className="menu w-full gap-1 p-0">
        {LINKS.map(({ href, label }) => {
          const current =
            href === "/admin" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={closeDrawer}
                aria-current={current ? "page" : undefined}
                className={`py-3 text-base font-bold ${current ? "menu-active" : ""}`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      <form action={signOut} className="mt-auto">
        <button type="submit" className="btn btn-outline w-full">
          Sign out
        </button>
      </form>
    </nav>
  );
}
