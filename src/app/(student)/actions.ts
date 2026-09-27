"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { assertPairedDevice } from "@/app/(student)/require-device";
import { db } from "@/db";
import {
  orderItemAddons,
  orderItems,
  orders,
  receiptJobs,
  shifts,
  students,
} from "@/db/schema";
import { isLockedOut, lockoutMinutesRemaining, verifyPin } from "@/lib/auth";
import { changeCents, hoursHundredthsBetween, orderTotalCents, rewardTickets } from "@/lib/money";
import { deliverQueuedEmails } from "@/lib/deliver-receipts";
import { isUniqueViolation } from "@/lib/pg-errors";
import { acceptCorrectPin, recordFailedPin } from "@/lib/pin-lockout";
import { getActiveShift } from "@/lib/queries";
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

  try {
    const [shift] = await db
      .insert(shifts)
      .values({ studentId: student.id })
      .returning();
    await setShiftSession(shift.id);
    return { ok: true, resumed: false };
  } catch (error) {
    // The one-open-shift partial unique index refused the insert (double tap or
    // lost cookie). Resume the existing open shift.
    if (isUniqueViolation(error)) {
      const open = await db.query.shifts.findFirst({
        where: and(eq(shifts.studentId, student.id), isNull(shifts.clockOut)),
      });
      if (open) {
        await setShiftSession(open.id);
        return { ok: true, resumed: true };
      }
    }
    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/* Complete an order                                                          */
/* -------------------------------------------------------------------------- */

export type CompleteOrderResult =
  | { ok: true; orderId: string; totalCents: number; changeCents: number }
  | { ok: false; error: "no_shift" | "invalid" | "insufficient" | "unknown_item" };

/**
 * Writes the order, lines, add-ons, and receipt jobs in one transaction.
 * Prices come from the database and the total and change are recomputed here;
 * client-supplied arithmetic is never trusted.
 */
export async function completeOrder(input: unknown): Promise<CompleteOrderResult> {
  await assertPairedDevice();
  const shiftId = await getShiftSession();
  if (!shiftId) return { ok: false, error: "no_shift" };

  const shift = await getActiveShift(shiftId);
  if (!shift) return { ok: false, error: "no_shift" };

  const parsed = parseCompleteOrder(input);
  if (!parsed) return { ok: false, error: "invalid" };

  const { teacherId, receivedCents, lines } = parsed;

  const menu = await db.query.menuItems.findMany();
  const extras = await db.query.addons.findMany();
  const menuById = new Map(menu.map((m) => [m.id, m]));
  const addonById = new Map(extras.map((a) => [a.id, a]));

  const priced = lines.map((line) => {
    const item = menuById.get(line.menuItemId);
    if (!item) throw new UnknownItem();
    const chosen = line.addonIds.map((id) => {
      const addon = addonById.get(id);
      if (!addon) throw new UnknownItem();
      return addon;
    });
    return { item, qty: line.qty, addons: chosen };
  });

  let totalCents: number;
  let change: number;
  try {
    totalCents = orderTotalCents(
      priced.map((p) => ({
        unitPriceCents: p.item.priceCents,
        qty: p.qty,
        addonPriceCents: p.addons.map((a) => a.priceCents),
      })),
    );
    change = changeCents(totalCents, receivedCents);
  } catch (error) {
    if (error instanceof UnknownItem) return { ok: false, error: "unknown_item" };
    return { ok: false, error: "insufficient" };
  }

  const orderId = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        shiftId: shift.id,
        teacherId,
        totalCents,
        paymentMethod: "cash",
        receivedCents,
        changeCents: change,
      })
      .returning({ id: orders.id });

    for (const line of priced) {
      const [row] = await tx
        .insert(orderItems)
        .values({
          orderId: order.id,
          menuItemId: line.item.id,
          nameSnapshot: line.item.name,
          qty: line.qty,
          unitPriceCents: line.item.priceCents,
        })
        .returning({ id: orderItems.id });

      if (line.addons.length > 0) {
        await tx.insert(orderItemAddons).values(
          line.addons.map((addon) => ({
            orderItemId: row.id,
            addonId: addon.id,
            nameSnapshot: addon.name,
            priceCents: addon.priceCents,
          })),
        );
      }
    }

    // Receipts are queued with the sale and delivered asynchronously, so a
    // printer or network failure never blocks an order. See
    // docs/adr/0002-receipt-job-queue.md.
    await tx.insert(receiptJobs).values({ orderId: order.id, channel: "print" });

    // No email job for a teacher without an email address.
    const teacher = await tx.query.persons.findFirst({
      where: (p, { eq: equals }) => equals(p.id, teacherId),
      columns: { email: true },
    });
    if (teacher?.email) {
      await tx.insert(receiptJobs).values({ orderId: order.id, channel: "email" });
    }

    return order.id;
  });

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
  return { ok: true, orderId, totalCents, changeCents: change };
}

class UnknownItem extends Error {}

/* -------------------------------------------------------------------------- */
/* Clock out                                                                  */
/* -------------------------------------------------------------------------- */

export type ClockOutResult =
  | { ok: true; hoursHundredths: number; tickets: number }
  | { ok: false; error: "no_shift" };

/**
 * Closes the shift and snapshots hours and tickets. Hours are computed from
 * server timestamps, never the device clock.
 */
export async function clockOut(): Promise<ClockOutResult> {
  await assertPairedDevice();
  const shiftId = await getShiftSession();
  if (!shiftId) return { ok: false, error: "no_shift" };

  const shift = await getActiveShift(shiftId);
  if (!shift) return { ok: false, error: "no_shift" };

  const now = new Date();
  const hoursHundredths = hoursHundredthsBetween(shift.clockIn, now);
  const tickets = rewardTickets(hoursHundredths);

  await db
    .update(shifts)
    .set({ clockOut: now, hoursHundredths, rewardTickets: tickets })
    .where(eq(shifts.id, shift.id));

  // Keep the session cookie so the summary can render; `finishShift` clears it.
  return { ok: true, hoursHundredths, tickets };
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
