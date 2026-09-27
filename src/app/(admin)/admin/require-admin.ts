import { redirect } from "next/navigation";

import { getAdmin, type AdminIdentity } from "@/lib/admin-auth";

/**
 * Guard for every admin page except sign-in. Call it at the top of each page:
 * a layout cannot stop a page's own data fetching, so the check belongs where
 * the data is read. (Kept out of layout.tsx, which may only export a component
 * and route config.)
 */
export async function requireAdmin(): Promise<AdminIdentity> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/sign-in");
  return admin;
}
