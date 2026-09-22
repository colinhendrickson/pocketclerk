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
