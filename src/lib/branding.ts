/**
 * White-label configuration.
 *
 * The public repository ships fictional defaults. A real deployment supplies its
 * own values through environment variables, so no school's name or reward
 * currency ever enters git. The main colour is the one setting staff change
 * themselves, on the admin Colors page (stored in `site_settings`, see
 * src/lib/settings.ts). Names, colour, logo and reward currency are data, and
 * nothing else is configurable.
 *
 * These are `NEXT_PUBLIC_` because the values are printed on screen and on
 * receipts; they are branding, not secrets.
 */

export interface Branding {
  /** The program that runs the cart, e.g. on paychecks and receipt headers. */
  programName: string;
  /** The cart itself, e.g. the wordmark on the student sign-in screen. */
  cartName: string;
  /** What a shift's earned reward is called. Singular-agnostic; used as a label. */
  rewardName: string;
  /** Optional logo for the sign-in email. Falls back to the PocketClerk mark. */
  logoUrl: string | null;
  /** Shows a banner and permits the nightly reset on the public demo. */
  demoMode: boolean;
}

function env(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.length > 0 ? value : fallback;
}

export const branding: Branding = {
  programName: env("NEXT_PUBLIC_PROGRAM_NAME", "Maple Grove Learning Program"),
  cartName: env("NEXT_PUBLIC_CART_NAME", "Sunrise Snack Cart"),
  rewardName: env("NEXT_PUBLIC_REWARD_NAME", "Tickets"),
  logoUrl: process.env.NEXT_PUBLIC_LOGO_URL || null,
  demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === "true",
};
