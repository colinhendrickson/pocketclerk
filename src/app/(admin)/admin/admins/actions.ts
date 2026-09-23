"use server";

import { revalidatePath } from "next/cache";

import { addAdmin, removeAdmin, type AddAdminResult, type RemoveAdminResult } from "@/lib/admins";

import { requireAdmin } from "../require-admin";

/**
 * Giving and removing admin access. `requireAdmin()` comes first in each: a
 * Server Action is its own POST endpoint and never passes through the layout.
 */

export async function giveAccess(input: unknown): Promise<AddAdminResult> {
  const admin = await requireAdmin();
  const result = await addAdmin(input, admin.personId);
  if (result.ok) {
    revalidatePath("/admin/admins");
    revalidatePath("/admin");
  }
  return result;
}

export async function removeAccess(personId: string): Promise<RemoveAdminResult> {
  const admin = await requireAdmin();
  if (typeof personId !== "string") return { ok: false, error: "not_found" };
  const result = await removeAdmin(personId, admin.personId);
  if (result.ok) {
    revalidatePath("/admin/admins");
    revalidatePath("/admin");
  }
  return result;
}
