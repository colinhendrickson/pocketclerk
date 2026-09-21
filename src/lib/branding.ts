/**
 * White-label configuration.
 *
 * The public repository ships fictional defaults. A real deployment supplies its
 * own values through environment variables, so no school's name, reward currency
 * or theme ever enters git. This is the entire white-label seam: names, colours,
 * logo and reward currency are data, and nothing else is configurable.
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
  /** Optional logo. Falls back to a text wordmark when unset. */
  logoUrl: string | null;
  /** Which committed daisyUI theme to apply, or a deployment skin name. */
  theme: string;
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
  theme: env("NEXT_PUBLIC_THEME", "pocketclerk"),
  demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === "true",
};
