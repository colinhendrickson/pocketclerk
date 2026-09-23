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
import { acceptCorrectPin, recordFailedPin } from "@/lib/pin-lockout";
import { getActiveShift } from "@/lib/queries";
import { parseClockIn, parseCompleteOrder, parseNewTeacher } from "@/lib/validate";
import { clearShiftSession, getShiftSession, setShiftSession } from "@/lib/session";
import { insertTeacher } from "@/lib/teachers";

/**
 * Server actions for the student flow.
 *
 * Every action re-derives money from the database rather than trusting numbers
 * that arrived from the browser, and every action that touches a shift checks
 * the signed session cookie first. Students have no database identity, so this
 * layer is the enforcement point; see the trust-boundary note in
 * drizzle/0001_constraints_and_rls.sql.
 */

/**
 * Postgres unique-violation (SQLSTATE 23505). A double clock-in surfaces here,
 * not as a bug.
 *
 * The code is read from `cause`, not from the error itself: Drizzle wraps
 * driver errors in its own "Failed query" error and the SQLSTATE lives on the
 * wrapped original. Checking the outer error silently never matches, which
 * turns the resume path into a 500 in front of a student.
 */
function isUniqueViolation(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string } } | null)?.cause;
  return cause?.code === "23505";
}

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
    // Counted in the database, in one statement. See src/lib/pin-lockout.ts
    // for why reading the count here and writing it back let parallel guesses
    // bypass the lockout entirely.
    const failed = await recordFailedPin(student.id);
    return failed.locked
      ? {
          ok: false,
          error: "locked_out",
          minutesRemaining: lockoutMinutesRemaining(failed.lockedUntil, new Date()),
        }
      : { ok: false, error: "wrong_pin", attemptsRemaining: failed.attemptsRemaining };
  }

  // The lock is checked again as the PIN is accepted, not only at the top: a
  // correct guess can be in flight while a burst of wrong ones locks the
  // student, and the lock has to win.
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
    // The partial unique index refused a second open shift. That is not a
    // failure: the student double-tapped, or came back to a device that lost
    // its cookie. Resume the shift they already have.
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
 * Writes the order, its lines, its add-ons and its receipt jobs in a single
 * transaction. Either the whole sale exists or none of it does.
 *
 * Prices come from the database, never from the request, and the total and
 * change are recomputed here. A client that posts its own arithmetic is a
 * client that can be wrong or lying; the server is the only place the money is
 * decided.
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

    // Queued in the same transaction as the sale. Delivery is somebody else's
    // problem: the tablet claims print jobs, the server claims email jobs, and
    // a dead printer or dropped WiFi delays a receipt without ever costing an
    // order.
    await tx.insert(receiptJobs).values({ orderId: order.id, channel: "print" });

    // An email job only exists if there is somewhere to send it. The absence of
    // a row is how "this teacher has no email" is represented, rather than a
    // job that is guaranteed to fail.
    const teacher = await tx.query.persons.findFirst({
      where: (p, { eq: equals }) => equals(p.id, teacherId),
      columns: { email: true },
    });
    if (teacher?.email) {
      await tx.insert(receiptJobs).values({ orderId: order.id, channel: "email" });
    }

    return order.id;
  });

  // Deliver the emailed receipt once the response has already reached the
  // student. The sale is committed and the screen has moved on, so a slow mail
  // provider cannot make the cart feel slow, and a failure here leaves the job
  // queued for the scheduled sweep rather than losing it.
  //
  // This is what makes the queue work on a free Vercel plan, where a cron job
  // may only run once a day: without it a teacher would wait until tomorrow.
  after(async () => {
    try {
      await deliverQueuedEmails();
    } catch (error) {
      // A failure on one job is recorded against that job's row. A failure
      // before any job is touched, such as claiming the batch on a dead
      // connection, has no row to land on, so without this it left no trace
      // anywhere. The receipt still waits in the queue for the nightly sweep.
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
 * Closes the shift and snapshots its derived values.
 *
 * Hours come from the two database timestamps, never from the tablet's clock:
 * a device with a wrong date must not be able to award itself a longer shift.
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

  // The cookie is deliberately left in place. Clearing it here would make the
  // next render of this page find no shift and bounce the student to sign-in
  // before they ever saw what they earned. `finishShift` clears it when they
  // tap through.
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
 * Adds a teacher mid-order.
 *
 * This is the one place a student types free text, and it is here because the
 * client's specification asks for it: a cart that visits a classroom whose
 * teacher is not on the list has to be able to serve them rather than stop.
 * Everything else in the student flow is taps.
 *
 * The email is optional. Without one the teacher simply gets no emailed
 * receipt, which is represented by the absence of an email job rather than by a
 * job that is guaranteed to fail.
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
