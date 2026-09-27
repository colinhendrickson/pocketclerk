/**
 * White-label configuration. The repository ships fictional defaults; a real
 * deployment sets its own through `NEXT_PUBLIC_` variables (branding, not
 * secrets). The main color is staff-editable instead (src/lib/settings.ts).
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
};
