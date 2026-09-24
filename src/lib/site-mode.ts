/**
 * Which kind of copy of PocketClerk this is.
 *
 * - `instance`: a school's cart, with its own database. The default.
 * - `demo`: pocket-clerk.com. A landing page, and the whole app on fake data
 *   that resets every hour. See docs/adr/0014-one-copy-per-school.md.
 *
 * Only the exact value "demo" selects the demo, so a typo can never switch a
 * school's copy into it. Demo-only powers also check the database
 * (src/lib/demo.ts), so a mistaken setting alone is not enough either.
 */
export type SiteMode = "instance" | "demo";

export function siteMode(): SiteMode {
  return process.env.NEXT_PUBLIC_SITE_MODE === "demo" ? "demo" : "instance";
}

/**
 * What a stranger sees instead of a school's name. Before sign-in, a school's
 * copy names only the product, so its address says nothing about the school.
 */
export const PRODUCT_NAME = "PocketClerk";
