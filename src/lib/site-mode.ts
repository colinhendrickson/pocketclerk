/**
 * Deployment mode: `instance` (a school's copy, the default) or `demo` (the
 * public demo on hourly-reset fake data). Only the exact value "demo" selects
 * the demo, and demo-only powers also check the database (src/lib/demo.ts).
 * See docs/adr/0014-one-copy-per-school-and-a-demo.md.
 */
export type SiteMode = "instance" | "demo";

export function siteMode(): SiteMode {
  return process.env.NEXT_PUBLIC_SITE_MODE === "demo" ? "demo" : "instance";
}

/** Shown instead of the school's name before sign-in. */
export const PRODUCT_NAME = "PocketClerk";
