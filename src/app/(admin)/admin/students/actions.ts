"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { students } from "@/db/schema";
import { hashPin } from "@/lib/auth";
import {
  parseActiveToggle,
  parseNewStudent,
  parseResetPin,
} from "@/lib/validate";

import { isUniqueViolation } from "@/lib/pg-errors";

import { requireAdmin } from "../require-admin";

/**
 * Server actions for the student roster.
 *
 * Every one of these calls `requireAdmin()` itself. A Server Action is a POST
 * endpoint reachable by anyone who can guess its id; the layout that renders
 * the form is not in the request path, so it protects nothing here. See the
 * security section of node_modules/next/dist/docs/01-app/02-guides/server-actions.md.
 *
 * Raw PINs never leave this file. They arrive from the form, go straight into
 * `hashPin`, and only the hash is written — the same rule the student sign-in
 * flow follows, for the same reason: a leaked table must not be a list of
 * working PINs.
 */

export type CreateStudentResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "duplicate" };

/**
 * Adds a student to the roster.
 *
 * The duplicate check is case-insensitive on the display name because the name
 * is the entire identity a student sees: two "Jordan"s on the sign-in grid is a
 * screen nobody can use correctly, whatever the database thinks. There is no
 * unique index behind this, so the check is advisory — the administrator can
 * resolve a genuine pair of same-named students by distinguishing the names,
 * which is the only fix that helps the student anyway.
 */
export async function createStudent(input: unknown): Promise<CreateStudentResult> {
  await requireAdmin();

  const parsed = parseNewStudent(input);
  if (!parsed) return { ok: false, error: "invalid" };

  // No pre-check. Reading and then inserting leaves a gap that two concurrent
  // requests can both pass, which is the exact pattern ADR 4 argues against.
  // The partial unique index cannot be raced, so the insert is attempted and
  // its refusal is turned into a message.
  try {
    await db.insert(students).values({
      displayName: parsed.displayName,
      pinHash: await hashPin(parsed.pin),
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "duplicate" };
    throw error;
  }

  revalidatePath("/admin/students");
  return { ok: true };
}

export type ResetStudentPinResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "not_found" };

/**
 * Sets a new PIN, typically because a student forgot theirs.
 *
 * The lockout counters are cleared in the same statement. A student who is
 * locked out is exactly the student most likely to be standing at the desk
 * asking for a reset, and leaving `locked_until` in place would hand them a new
 * PIN that does not work for another quarter of an hour.
 */
export async function resetStudentPin(
  input: unknown,
): Promise<ResetStudentPinResult> {
  await requireAdmin();

  const parsed = parseResetPin(input);
  if (!parsed) return { ok: false, error: "invalid" };

  const updated = await db
    .update(students)
    .set({
      pinHash: await hashPin(parsed.pin),
      failedAttempts: 0,
      lockedUntil: null,
    })
    .where(eq(students.id, parsed.studentId))
    .returning({ id: students.id });

  if (updated.length === 0) return { ok: false, error: "not_found" };

  revalidatePath("/admin/students");
  return { ok: true };
}

export type SetStudentActiveResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "not_found" };

/**
 * Deactivating is the only kind of removal in this application.
 *
 * A student's shifts and the orders taken during them are school records; a
 * delete would either orphan them or take them with it. Setting `active` to
 * false removes the student from the sign-in grid and leaves every hour they
 * worked intact, which is also what makes reactivating a returning student a
 * single click instead of a re-entry.
 */
export async function setStudentActive(
  input: unknown,
): Promise<SetStudentActiveResult> {
  await requireAdmin();

  const parsed = parseActiveToggle(input);
  if (!parsed) return { ok: false, error: "invalid" };

  const updated = await db
    .update(students)
    .set({ active: parsed.active })
    .where(eq(students.id, parsed.id))
    .returning({ id: students.id });

  if (updated.length === 0) return { ok: false, error: "not_found" };

  revalidatePath("/admin/students");
  return { ok: true };
}
