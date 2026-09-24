"use server";

import { revalidatePath } from "next/cache";

import { setPrimaryColor, type SetPrimaryColorResult } from "@/lib/settings";

import { requireAdmin } from "../require-admin";

/** Saves the main colour, or clears it with null. Every page picks it up. */
export async function saveColor(input: unknown): Promise<SetPrimaryColorResult> {
  const admin = await requireAdmin();
  const result = await setPrimaryColor(input, admin.personId);
  // The colour is in the layouts, so every page is out of date.
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
