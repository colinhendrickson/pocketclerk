"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { signOut } from "./actions";

/** The id of the drawer's checkbox, shared with the hamburger in the layout. */
export const ADMIN_DRAWER_ID = "admin-drawer";
const MENU_BUTTON_ID = "admin-menu-button";
const NAV_ID = "admin-nav";

function drawerToggle(): HTMLInputElement | null {
  const toggle = document.getElementById(ADMIN_DRAWER_ID);
  return toggle instanceof HTMLInputElement ? toggle : null;
}

/**
 * Opens the admin menu below xl.
 *
 * A real button, not the `<label>` daisyUI's drawer examples use: a label is
 * not reachable by keyboard and cannot carry a name or an open state. This
 * drives the drawer's checkbox, reports `aria-expanded`, and moves focus into
 * the menu so a keyboard or screen reader user lands where the links are.
 */
export function AdminMenuButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const toggle = drawerToggle();
    if (!toggle) return;
    const sync = () => setOpen(toggle.checked);
    toggle.addEventListener("change", sync);
    return () => toggle.removeEventListener("change", sync);
  }, []);

  function openMenu() {
    const toggle = drawerToggle();
    if (!toggle) return;
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change"));
    focusFirstLink();
  }

  /**
   * The drawer fades in, and a link cannot take focus until it is visible, so
   * this retries each frame for up to half a second.
   */
  function focusFirstLink(started = performance.now()) {
    const link = document.querySelector<HTMLElement>(`#${NAV_ID} a`);
    link?.focus();
    if (document.activeElement !== link && performance.now() - started < 500) {
      requestAnimationFrame(() => focusFirstLink(started));
    }
  }

  return (
    <button
      type="button"
      id={MENU_BUTTON_ID}
      onClick={openMenu}
      aria-expanded={open}
      aria-controls={NAV_ID}
      className="btn btn-ghost btn-square xl:hidden"
    >
      <Menu size={24} aria-hidden="true" />
      <span className="sr-only">Menu</span>
    </button>
  );
}

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
    const toggle = drawerToggle();
    if (!toggle?.checked) return;
    toggle.checked = false;
    toggle.dispatchEvent(new Event("change"));
  }

  // Escape closes the menu and puts focus back on the button that opened it.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || !drawerToggle()?.checked) return;
      closeDrawer();
      document.getElementById(MENU_BUTTON_ID)?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <nav
      id={NAV_ID}
      aria-label="Admin"
      className="flex min-h-full w-64 flex-col gap-4 border-r border-base-300 bg-base-100 p-4"
    >
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
