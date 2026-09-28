"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { assertPairedDevice } from "@/app/(student)/require-device";
import { db } from "@/db";
import { students } from "@/db/schema";
import { isLockedOut, lockoutMinutesRemaining, verifyPin } from "@/lib/auth";
import { deliverQueuedEmails } from "@/lib/deliver-receipts";
import { placeOrder } from "@/lib/orders";
import { acceptCorrectPin, recordFailedPin } from "@/lib/pin-lockout";
import { getActiveShift } from "@/lib/queries";
import { clockOutShift, startShift } from "@/lib/shifts";
import { parseClockIn, parseCompleteOrder, parseNewTeacher } from "@/lib/validate";
import { clearShiftSession, getShiftSession, setShiftSession } from "@/lib/session";
import { insertTeacher } from "@/lib/teachers";

/**
 * Server actions for the student flow. Students have no database identity, so
 * this layer is the enforcement point: money is re-derived from the database,
 * never trusted from the browser, and shift actions check the signed session
 * cookie. See docs/adr/0003-rls-and-the-trust-boundary.md.
 */

/* -------------------------------------------------------------------------- */
/* Clock in                                                                   */
/* -------------------------------------------------------------------------- */

export type ClockInResult =
  | { ok: true; resumed: boolean }
  | { ok: false; error: "wrong_pin"; attemptsRemaining: number }
  | { ok: false; error: "locked_out"; minutesRemaining: number }
  | { ok: false; error: "invalid" };

export async function clockIn(input: unknown): Promise<ClockInResult> {
  await assertPairedDevice();
  const parsed = parseClockIn(input);
  if (!parsed) return { ok: false, error: "invalid" };

  const student = await db.query.students.findFirst({
    where: and(eq(students.id, parsed.studentId), eq(students.active, true)),
  });
  if (!student) return { ok: false, error: "invalid" };

  const now = new Date();
  if (isLockedOut(student.lockedUntil, now)) {
    return {
      ok: false,
      error: "locked_out",
      minutesRemaining: lockoutMinutesRemaining(student.lockedUntil!, now),
    };
  }

  if (!(await verifyPin(student.pinHash, parsed.pin))) {
    // Counted atomically in the database so parallel guesses cannot bypass the
    // lockout. See src/lib/pin-lockout.ts.
    const failed = await recordFailedPin(student.id);
    return failed.locked
      ? {
          ok: false,
          error: "locked_out",
          minutesRemaining: lockoutMinutesRemaining(failed.lockedUntil, new Date()),
        }
      : { ok: false, error: "wrong_pin", attemptsRemaining: failed.attemptsRemaining };
  }

  // Re-check the lock atomically on acceptance: a correct guess racing a burst
  // of wrong ones must not win over the lockout.
  if (!(await acceptCorrectPin(student.id))) {
    const [current] = await db
      .select({ lockedUntil: students.lockedUntil })
      .from(students)
      .where(eq(students.id, student.id));
    return {
      ok: false,
      error: "locked_out",
      minutesRemaining: lockoutMinutesRemaining(current?.lockedUntil ?? new Date(), new Date()),
    };
  }

  // Resumes today's open shift (double tap or lost cookie); a forgotten shift
  // from an earlier day is closed with no hours. See src/lib/shifts.ts.
  const shift = await startShift(student.id);
  await setShiftSession(shift.shiftId);
  return { ok: true, resumed: shift.resumed };
}

/* -------------------------------------------------------------------------- */
/* Complete an order                                                          */
/* -------------------------------------------------------------------------- */

export type CompleteOrderResult =
  | { ok: true; orderId: string; totalCents: number; changeCents: number }
  | { ok: false; error: "no_shift" | "invalid" | "insufficient" | "unknown_item" };

/**
 * Records a sale. Pricing, idempotency and receipt jobs live in
 * src/lib/orders.ts; a retried order id returns the recorded result.
 */
export async function completeOrder(input: unknown): Promise<CompleteOrderResult> {
  await assertPairedDevice();
  const shiftId = await getShiftSession();
  if (!shiftId) return { ok: false, error: "no_shift" };

  const shift = await getActiveShift(shiftId);
  if (!shift) return { ok: false, error: "no_shift" };

  const parsed = parseCompleteOrder(input);
  if (!parsed) return { ok: false, error: "invalid" };

  const result = await placeOrder(shift.id, parsed);
  if (!result.ok) return result;
  const { orderId, totalCents, changeCents } = result;
  if (!result.created) return { ok: true, orderId, totalCents, changeCents };

  // Send email receipts after the response so a slow provider never delays the
  // cart. Failures leave jobs queued for the daily cron sweep, which on the free
  // Vercel plan is otherwise the only delivery path.
  after(async () => {
    try {
      await deliverQueuedEmails();
    } catch (error) {
      // Per-job failures are recorded on the job row; this logs failures that
      // happen before any job is claimed.
      console.error(
        `[receipts] post-order delivery failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });

  revalidatePath("/shift");
  return { ok: true, orderId, totalCents, changeCents };
}

/* -------------------------------------------------------------------------- */
/* Clock out                                                                  */
/* -------------------------------------------------------------------------- */

export type ClockOutResult =
  | { ok: true; hoursHundredths: number; tickets: number }
  | { ok: false; error: "no_shift" };

/**
 * Closes the shift and snapshots hours and tickets from server time. A shift
 * left open from an earlier day closes with no hours. See src/lib/shifts.ts.
 */
export async function clockOut(): Promise<ClockOutResult> {
  await assertPairedDevice();
  const shiftId = await getShiftSession();
  if (!shiftId) return { ok: false, error: "no_shift" };

  const closed = await clockOutShift(shiftId);
  if (!closed) return { ok: false, error: "no_shift" };

  // Keep the session cookie so the summary can render; `finishShift` clears it.
  return { ok: true, hoursHundredths: closed.hoursHundredths, tickets: closed.tickets };
}

/** Ends the session once the student has seen their shift summary. */
export async function finishShift(): Promise<void> {
  await assertPairedDevice();
  await clearShiftSession();
}

/* -------------------------------------------------------------------------- */
/* Add a teacher                                                              */
/* -------------------------------------------------------------------------- */

export type CreateTeacherResult =
  | { ok: true; teacher: { id: string; name: string; room: string | null; email: string | null; notes: string[] } }
  | { ok: false; error: "no_shift" | "invalid" | "duplicate" };

/**
 * Adds a teacher mid-order, so the cart can serve a classroom not yet on the
 * list. This is the only free-text entry in the student flow. Email is
 * optional; without one no email receipt job is created.
 */
export async function createTeacher(input: unknown): Promise<CreateTeacherResult> {
  await assertPairedDevice();
  const shiftId = await getShiftSession();
  if (!shiftId) return { ok: false, error: "no_shift" };
  if (!(await getActiveShift(shiftId))) return { ok: false, error: "no_shift" };

  const parsed = parseNewTeacher(input);
  if (!parsed) return { ok: false, error: "invalid" };

  const result = await insertTeacher(parsed);
  if (!result.ok) return result;

  revalidatePath("/shift/order");
  return { ok: true, teacher: result.teacher };
}
