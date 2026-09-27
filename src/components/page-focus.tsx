"use client";

/**
 * Root-level focus management.
 *
 * - `SkipLink`: first Tab stop, visible only when focused (WCAG 2.4.1).
 * - `RouteFocus`: after a client-side navigation, moves focus to the new
 *   screen's heading so screen readers announce it and Tab starts at the
 *   content.
 *
 * Both target the page's `h1`; every screen must render exactly one.
 * See docs/adr/0012-help-in-code-and-tested-accessibility.md.
 */

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

function focusHeading(): boolean {
  const heading = document.querySelector<HTMLElement>("h1");
  if (!heading) return false;
  // tabindex -1: focusable by script without joining the Tab order.
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
    // Skip the initial load (the browser handles it). Compare pathnames rather
    // than using a first-render flag, since dev mode runs effects twice.
    if (previous.current === pathname) return;
    previous.current = pathname;
    // Wait for the new screen to paint.
    const id = requestAnimationFrame(() => focusHeading());
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return null;
}
