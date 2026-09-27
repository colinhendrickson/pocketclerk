import { redirect } from "next/navigation";

import { isPaired } from "@/lib/device";

/**
 * Guard for every student page. Called in each page, not the layout, because a
 * layout cannot stop a page's own data fetching. See
 * docs/adr/0010-device-pairing.md.
 */
export async function requirePairedDevice(): Promise<void> {
  if (!(await isPaired())) redirect("/not-set-up");
}

/**
 * The same guard for server actions. Each action is a public POST endpoint
 * whose id ships in the client bundle and bypasses the page guard, so every
 * action must check pairing itself. Throws rather than redirecting, since only
 * a caller bypassing the UI can reach this path.
 */
export async function assertPairedDevice(): Promise<void> {
  if (!(await isPaired())) throw new Error("This device is not set up for the cart.");
}
