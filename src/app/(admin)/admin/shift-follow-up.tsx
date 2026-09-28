"use client";

import { useState, useTransition } from "react";

import type { ShiftFollowUpRow } from "@/lib/shifts";
import { cartFormatter } from "@/lib/time";

import { closeShift } from "./students/actions";

const WHEN = cartFormatter({
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const DAY = cartFormatter({ weekday: "short", month: "short", day: "numeric" });

export interface ShiftFollowUpProps {
  openShifts: ShiftFollowUpRow[];
  autoClosed: ShiftFollowUpRow[];
  /** Local midnight today; open shifts from before it were forgotten. */
  startOfToday: Date;
  /** How far back `autoClosed` looks, for the explanation. */
  lookbackDays: number;
}

/**
 * Open shifts, with a way to close a stuck one, and recent shifts the cart
 * closed on its own because the student never clocked out.
 */
export function ShiftFollowUp({
  openShifts,
  autoClosed,
  startOfToday,
  lookbackDays,
}: ShiftFollowUpProps) {
  if (openShifts.length === 0 && autoClosed.length === 0) return null;

  return (
    <section aria-labelledby="shifts-heading" className="flex flex-col gap-3">
      <h2 id="shifts-heading" className="text-xl font-extrabold">
        Shifts to check
      </h2>

      {openShifts.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="font-extrabold">Open now</h3>
          <ul className="flex flex-col gap-2">
            {openShifts.map((shift) => (
              <OpenShiftRow key={shift.id} shift={shift} forgotten={shift.clockIn < startOfToday} />
            ))}
          </ul>
        </div>
      ) : null}

      {autoClosed.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="font-extrabold">Closed with no hours</h3>
          <p className="max-w-prose text-sm opacity-75">
            These students did not clock out, so the cart closed the shift the next time they
            signed in and counted no hours. Check with them how long they worked. Shows the
            last {lookbackDays} days.
          </p>
          <ul className="flex flex-col gap-1">
            {autoClosed.map((shift) => (
              <li key={shift.id} className="flex flex-wrap gap-x-2">
                <span className="font-bold">{shift.studentName}</span>
                <span className="opacity-75">
                  started <span className="tabular">{DAY.format(shift.clockIn)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function OpenShiftRow({ shift, forgotten }: { shift: ShiftFollowUpRow; forgotten: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setError(null);
    startTransition(async () => {
      const result = await closeShift({ shiftId: shift.id });
      if (!result.ok) {
        setError(
          result.error === "already_closed"
            ? "That shift is already closed. Reload the page."
            : "That did not save. Reload and try again.",
        );
      }
      setConfirming(false);
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-box border border-base-300 bg-base-100 p-3">
      <span className="font-bold">{shift.studentName}</span>
      <span className="opacity-75">
        since <span className="tabular">{WHEN.format(shift.clockIn)}</span>
      </span>
      {forgotten ? <span className="badge badge-warning badge-sm">From an earlier day</span> : null}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {confirming ? (
          <>
            <span className="text-sm">No hours are counted for this shift.</span>
            <button type="button" onClick={close} disabled={pending} className="btn btn-sm btn-warning">
              {pending ? "Closing…" : "Close shift"}
              <span className="sr-only"> for {shift.studentName}</span>
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="btn btn-sm btn-ghost">
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="btn btn-sm btn-outline"
          >
            Close shift<span className="sr-only"> for {shift.studentName}</span>
          </button>
        )}
      </div>

      {error ? (
        <p role="alert" className="w-full text-sm font-bold text-error">
          {error}
        </p>
      ) : null}
    </li>
  );
}
