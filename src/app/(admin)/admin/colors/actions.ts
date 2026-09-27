"use server";

import { revalidatePath } from "next/cache";

import { setPrimaryColor, type SetPrimaryColorResult } from "@/lib/settings";

import { requireAdmin } from "../require-admin";

/** Saves the main color, or clears it with null. */
export async function saveColor(input: unknown): Promise<SetPrimaryColorResult> {
  const admin = await requireAdmin();
  const result = await setPrimaryColor(input, admin.personId);
  // The color is applied in layouts, so every page is stale.
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
