"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { students } from "@/db/schema";
import { hashPin } from "@/lib/auth";
import {
  isUuid,
  parseActiveToggle,
  parseNewStudent,
  parseRenameStudent,
  parseResetPin,
} from "@/lib/validate";

import { startPayPeriod } from "@/lib/pay-periods";
import { isUniqueViolation } from "@/lib/pg-errors";
import { closeShiftByStaff } from "@/lib/shifts";

import { requireAdmin } from "../require-admin";

/**
 * Student roster server actions.
 *
 * Each calls `requireAdmin()` itself: a server action is a public POST endpoint
 * and does not pass through the layout. Raw PINs go straight into `hashPin`;
 * only the hash is stored.
 */

export type CreateStudentResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "duplicate" };

/**
 * Adds a student. Display names must be unique (case-insensitively) among
 * active students, since the name is how a student finds themselves on the
 * sign-in grid.
 */
export async function createStudent(input: unknown): Promise<CreateStudentResult> {
  await requireAdmin();

  const parsed = parseNewStudent(input);
  if (!parsed) return { ok: false, error: "invalid" };

  // Rely on the partial unique index rather than a racy pre-check. See
  // docs/adr/0004-invariants-in-the-database.md.
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
 * Sets a new PIN and clears the lockout in the same statement, so the new PIN
 * works immediately.
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

export type RenameStudentResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "duplicate" | "not_found" };

/**
 * Corrects a student's name (4.22). The student keeps their id, so their
 * shifts, hours and sales stay theirs. The same unique index as
 * `createStudent` refuses a name another active student already has.
 */
export async function renameStudent(input: unknown): Promise<RenameStudentResult> {
  await requireAdmin();

  const parsed = parseRenameStudent(input);
  if (!parsed) return { ok: false, error: "invalid" };

  let updated: { id: string }[];
  try {
    updated = await db
      .update(students)
      .set({ displayName: parsed.displayName })
      .where(eq(students.id, parsed.studentId))
      .returning({ id: students.id });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "duplicate" };
    throw error;
  }

  if (updated.length === 0) return { ok: false, error: "not_found" };

  revalidatePath("/admin/students");
  return { ok: true };
}

export type StartNewPayPeriodResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "stale" };

/**
 * Starts a new pay period (4.23): from now on the roster counts hours from
 * this moment. `previousId` is the period the page showed, so a second click
 * or an old tab cannot start another one.
 */
export async function startNewPayPeriod(input: unknown): Promise<StartNewPayPeriodResult> {
  const admin = await requireAdmin();

  const raw = (input as { previousId?: unknown } | null)?.previousId;
  const previousId = raw === null ? null : isUuid(raw) ? raw : undefined;
  if (previousId === undefined) return { ok: false, error: "invalid" };

  const result = await startPayPeriod({ previousId, startedBy: admin.personId });
  if (!result.ok) return result;

  revalidatePath("/admin/students");
  return { ok: true };
}

export type SetStudentActiveResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "not_found" };

export type CloseShiftResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "already_closed" };

/**
 * Closes a shift a student never clocked out of, with no hours credited. Used
 * from the admin home page.
 */
export async function closeShift(input: unknown): Promise<CloseShiftResult> {
  await requireAdmin();

  const shiftId = (input as { shiftId?: unknown } | null)?.shiftId;
  if (!isUuid(shiftId)) return { ok: false, error: "invalid" };

  if (!(await closeShiftByStaff(shiftId))) return { ok: false, error: "already_closed" };

  revalidatePath("/admin");
  revalidatePath("/admin/students");
  return { ok: true };
}

/**
 * Soft-deletes or restores a student. Students are never hard-deleted: their
 * shifts and orders are school records. Inactive students leave the sign-in
 * grid with their hours intact.
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
