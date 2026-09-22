import { redirect } from "next/navigation";

import { getAdmin, type AdminIdentity } from "@/lib/admin-auth";

/**
 * Guard for every admin page except sign-in.
 *
 * Lives beside the layout rather than in it because a Next.js layout file may
 * only export a component and its route config; a helper exported from there
 * fails the route type check.
 *
 * Called at the top of each page rather than only in the layout. A layout
 * cannot stop a page's own data fetching from running, so the check belongs
 * where the data is read.
 */
export async function requireAdmin(): Promise<AdminIdentity> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/sign-in");
  return admin;
}
