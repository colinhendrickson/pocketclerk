"use client";

import { useState, useTransition } from "react";

import type { StudentRow } from "@/lib/admin-queries";
import { formatHours } from "@/lib/money";

import { renameStudent, resetStudentPin, setStudentActive } from "./actions";

export interface StudentTableProps {
  rows: StudentRow[];
  /** White-label name for reward tickets, e.g. from `branding`. */
  rewardName: string;
}

/** Which inline form is open, and on whose row. One at a time. */
type OpenForm = { studentId: string; form: "pin" | "name" } | null;

/**
 * Roster table with this pay period's shifts and hours, lifetime totals,
 * inline name edit and PIN reset, and deactivation. Inactive students stay in
 * the table, visibly marked, so it is clear why they cannot sign in.
 */
export function StudentTable({ rows, rewardName }: StudentTableProps) {
  const [open, setOpen] = useState<OpenForm>(null);

  return (
    <div
        role="region"
        data-tour="student-table"
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
            <th className="text-right">All-time hours</th>
            <th className="text-right">{rewardName}</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <StudentRows
              key={row.id}
              row={row}
              openForm={open?.studentId === row.id ? open.form : null}
              onToggle={(form) =>
                setOpen((current) =>
                  current?.studentId === row.id && current.form === form
                    ? null
                    : { studentId: row.id, form },
                )
              }
              onClose={() => setOpen(null)}
            />
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={COLUMNS} className="py-6 text-center opacity-70">
                No students yet. Add the first one above.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

const COLUMNS = 7;

interface StudentRowsProps {
  row: StudentRow;
  openForm: "pin" | "name" | null;
  onToggle: (form: "pin" | "name") => void;
  onClose: () => void;
}

/**
 * One or two `<tr>`s: the student row, plus a full-width form row when one is
 * open, keeping column alignment.
 */
function StudentRows({ row, openForm, onToggle, onClose }: StudentRowsProps) {
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
        <td className="text-right tabular">{row.periodShiftCount}</td>
        <td className="text-right tabular font-bold">
          {formatHours(row.periodHoursHundredths)}
        </td>
        <td className="text-right tabular">{formatHours(row.hoursHundredths)}</td>
        <td className="text-right tabular">{row.rewardTickets}</td>
        <td>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onToggle("name")}
              aria-expanded={openForm === "name"}
              className="btn btn-ghost btn-xs"
            >
              {openForm === "name" ? "Cancel" : "Edit name"}
            </button>
            <button
              type="button"
              onClick={() => onToggle("pin")}
              aria-expanded={openForm === "pin"}
              className="btn btn-ghost btn-xs"
            >
              {openForm === "pin" ? "Cancel" : "Reset PIN"}
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
          <td colSpan={COLUMNS} role="alert" className="text-sm font-bold text-error">
            {error}
          </td>
        </tr>
      ) : null}

      {openForm === "name" ? (
        <tr>
          <td colSpan={COLUMNS} className="bg-base-200">
            <EditNameForm studentId={row.id} currentName={row.displayName} onDone={onClose} />
          </td>
        </tr>
      ) : null}

      {openForm === "pin" ? (
        <tr>
          <td colSpan={COLUMNS} className="bg-base-200">
            <ResetPinForm studentId={row.id} studentName={row.displayName} onDone={onClose} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

interface EditNameFormProps {
  studentId: string;
  currentName: string;
  onDone: () => void;
}

/**
 * Name correction (4.22), such as adding a last name. The student keeps their
 * PIN, shifts and hours; only the name on the sign-in list changes.
 */
function EditNameForm({ studentId, currentName, onDone }: EditNameFormProps) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const trimmed = name.trim();
  const ready = trimmed.length >= 2 && trimmed !== currentName;

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await renameStudent({ studentId, displayName: name });
      if (result.ok) {
        onDone();
        return;
      }
      setError(
        result.error === "duplicate"
          ? "Another student on the roster already has that name."
          : result.error === "not_found"
            ? "That student no longer exists. Reload the page."
            : "A name needs at least two letters.",
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
      <label className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-bold">New name for {currentName}</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
          autoFocus
          maxLength={80}
          className="input input-bordered input-sm w-56"
        />
      </label>
      <button type="submit" disabled={!ready || pending} className="btn btn-primary btn-sm">
        {pending ? "Saving…" : "Save name"}
      </button>
      <span className="text-sm opacity-70">Their PIN, shifts and hours stay the same.</span>
      {error ? (
        <span role="alert" className="text-sm font-bold text-error">
          {error}
        </span>
      ) : null}
    </form>
  );
}

interface ResetPinFormProps {
  studentId: string;
  studentName: string;
  onDone: () => void;
}

/**
 * PIN reset. The new PIN is visible while typed and never shown again: only
 * the scrypt hash is stored, so a forgotten PIN can only be reset.
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
