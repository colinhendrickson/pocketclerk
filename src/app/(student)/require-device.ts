import { redirect } from "next/navigation";

import { isPaired } from "@/lib/device";

/**
 * Guard for every student screen.
 *
 * Called at the top of each page rather than only in the layout, for the same
 * reason the admin guard is: a layout cannot stop a page's own data fetching
 * from running, so the check belongs where the data is read. A page that forgets
 * it would list children's names to the open internet.
 */
export async function requirePairedDevice(): Promise<void> {
  if (!(await isPaired())) redirect("/not-set-up");
}

/**
 * The same guard for server actions.
 *
 * A page guard does not protect the actions that page calls. Each server
 * action is its own POST endpoint, reachable with its id, which ships in the
 * public JavaScript bundle, and it never passes through the page that rendered
 * the button. So pairing only hid the screens: `clockIn` could still be called
 * directly by anyone who had a student's id, and it is the endpoint that
 * checks PINs.
 *
 * Throws rather than redirecting. A paired iPad never reaches this path, so
 * the only caller who sees it is one who went around the screens, and that
 * caller gets no help.
 */
export async function assertPairedDevice(): Promise<void> {
  if (!(await isPaired())) throw new Error("This device is not set up for the cart.");
}
