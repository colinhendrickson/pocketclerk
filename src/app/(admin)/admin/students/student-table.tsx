"use client";

import { useState, useTransition } from "react";

import type { StudentRow } from "@/lib/admin-queries";
import { formatHours } from "@/lib/money";

import { resetStudentPin, setStudentActive } from "./actions";

export interface StudentTableProps {
  rows: StudentRow[];
  /** White-label name for reward tickets, e.g. from `branding`. */
  rewardName: string;
}

/**
 * The roster, with lifetime totals and the two things that are ever done to a
 * student: a PIN reset and a deactivation.
 *
 * A client component because the PIN reset opens in place. Routing to a detail
 * page to change one four-digit field, then routing back, is three screens for
 * a job that takes four keystrokes.
 *
 * Inactive students stay in the table rather than moving to a separate list.
 * The question the administrator actually asks is "why can't this student sign
 * in?", and a row that is present but visibly switched off answers it; a row
 * that has vanished looks like data loss.
 */
export function StudentTable({ rows, rewardName }: StudentTableProps) {
  const [resetting, setResetting] = useState<string | null>(null);

  return (
    <div
        role="region"
        aria-label="Students"
        tabIndex={0}
        className="overflow-x-auto rounded-box border border-base-300 bg-base-100"
      >
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th className="text-right">Shifts</th>
            <th className="text-right">Hours</th>
            <th className="text-right">{rewardName}</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <StudentRows
              key={row.id}
              row={row}
              isResetting={resetting === row.id}
              onToggleReset={() =>
                setResetting((current) => (current === row.id ? null : row.id))
              }
            />
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-6 text-center opacity-70">
                No students yet. Add the first one above.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

interface StudentRowsProps {
  row: StudentRow;
  isResetting: boolean;
  onToggleReset: () => void;
}

/**
 * Returns a fragment of one or two `<tr>`s rather than a single row, so the
 * reset form can occupy a full-width row underneath without nesting a second
 * table or breaking the column alignment above it.
 */
function StudentRows({ row, isResetting, onToggleReset }: StudentRowsProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggleActive() {
    setError(null);
    startTransition(async () => {
      const result = await setStudentActive({ id: row.id, active: !row.active });
      if (!result.ok) setError("That change did not save. Reload and try again.");
    });
  }

  return (
    <>
      <tr className={row.active ? undefined : "opacity-75"}>
        <td className="font-bold">{row.displayName}</td>
        <td>
          <span className={`badge badge-sm whitespace-nowrap ${row.active ? "badge-success" : "badge-ghost"}`}>
            {row.active ? "Active" : "Inactive"}
          </span>
        </td>
        <td className="text-right tabular">{row.shiftCount}</td>
        <td className="text-right tabular">{formatHours(row.hoursHundredths)}</td>
        <td className="text-right tabular">{row.rewardTickets}</td>
        <td>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onToggleReset}
              aria-expanded={isResetting}
              className="btn btn-ghost btn-xs"
            >
              {isResetting ? "Cancel" : "Reset PIN"}
            </button>
            <button
              type="button"
              onClick={toggleActive}
              disabled={pending}
              className={`btn btn-xs ${row.active ? "btn-outline" : "btn-outline btn-success"}`}
            >
              {row.active ? "Deactivate" : "Reactivate"}
            </button>
          </div>
        </td>
      </tr>

      {error ? (
        <tr>
          <td colSpan={6} role="alert" className="text-sm font-bold text-error">
            {error}
          </td>
        </tr>
      ) : null}

      {isResetting ? (
        <tr>
          <td colSpan={6} className="bg-base-200">
            <ResetPinForm
              studentId={row.id}
              studentName={row.displayName}
              onDone={onToggleReset}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}

interface ResetPinFormProps {
  studentId: string;
  studentName: string;
  onDone: () => void;
}

/**
 * The new PIN is shown in plain text while it is typed and is never shown
 * again. There is nothing to read back: only the scrypt hash is stored, so a
 * forgotten PIN is always a reset, never a lookup. Saying so here is what stops
 * the administrator hunting for a "view PIN" button that cannot exist.
 */
function ResetPinForm({ studentId, studentName, onDone }: ResetPinFormProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ready = /^\d{4}$/.test(pin);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await resetStudentPin({ studentId, pin });
      if (result.ok) {
        setPin("");
        onDone();
        return;
      }
      setError(
        result.error === "not_found"
          ? "That student no longer exists. Reload the page."
          : "A PIN is exactly four digits.",
      );
    });
  }

  return (
    <form
      className="flex flex-wrap items-center gap-3 py-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) submit();
      }}
    >
      <span className="text-sm font-bold">New PIN for {studentName}</span>
      <input
        value={pin}
        onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        aria-label={`New PIN for ${studentName}`}
        className="input input-bordered input-sm w-24 tabular"
      />
      <button type="submit" disabled={!ready || pending} className="btn btn-primary btn-sm">
        {pending ? "Saving…" : "Save PIN"}
      </button>
      <span className="text-sm opacity-70">
        Write it down before you save. It cannot be read back afterwards.
      </span>
      {error ? (
        <span role="alert" className="text-sm font-bold text-error">
          {error}
        </span>
      ) : null}
    </form>
  );
}
