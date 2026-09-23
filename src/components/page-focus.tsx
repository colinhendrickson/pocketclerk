"use client";

/**
 * Where keyboard and screen reader focus goes, on every screen.
 *
 * Two WCAG failures a single-page app makes by default, fixed once at the root:
 *
 * - Nothing lets a keyboard user skip the navigation (2.4.1). `SkipLink` is the
 *   first thing Tab reaches, invisible until focused.
 * - A client-side navigation changes the page without telling anyone. Focus
 *   stays on the link that was pressed, which may no longer exist, and a screen
 *   reader says nothing about the new screen. `RouteFocus` moves focus to the
 *   new screen's heading, so it is read aloud and Tab starts from the top of
 *   the content.
 *
 * Both target the page's `h1`, which every screen has: it is the one element
 * guaranteed to mark where the content starts.
 */

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

function focusHeading(): boolean {
  const heading = document.querySelector<HTMLElement>("h1");
  if (!heading) return false;
  // Headings are not focusable by default; -1 makes them focusable by script
  // without adding them to the Tab order.
  if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
  heading.setAttribute("data-route-focus", "");
  heading.focus({ preventScroll: true });
  return true;
}

export function SkipLink() {
  return (
    <a
      href="#content"
      onClick={(event) => {
        if (focusHeading()) event.preventDefault();
      }}
      className="btn btn-primary sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
    >
      Skip to content
    </a>
  );
}

export function RouteFocus() {
  const pathname = usePathname();
  const previous = useRef(pathname);

  useEffect(() => {
    // Only a change of address counts. On a full page load the browser already
    // starts at the top and a screen reader announces the page itself. (A
    // "first render" flag is not enough: development runs effects twice.)
    if (previous.current === pathname) return;
    previous.current = pathname;
    // After the new screen has painted.
    const id = requestAnimationFrame(() => focusHeading());
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return null;
}
