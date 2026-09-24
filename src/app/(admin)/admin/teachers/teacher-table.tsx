"use client";

import { useState, useTransition } from "react";

import type { TeacherRow } from "@/lib/admin-queries";
import { formatUSD } from "@/lib/money";

import {
  addTeacherNote,
  removeTeacherNote,
  setTeacherActive,
  updateTeacher,
} from "./actions";

/**
 * An order as this table shows it.
 *
 * The timestamp arrives already formatted. Rendering a date in a client
 * component means the server formats it in the server's time zone and the
 * browser re-formats it in the viewer's, which React reports as a hydration
 * mismatch; formatting once, on the server, removes the second opinion.
 */
export interface TeacherOrderView {
  id: string;
  when: string;
  totalCents: number;
}

export interface TeacherView extends Omit<TeacherRow, "recentOrders"> {
  recentOrders: TeacherOrderView[];
}

export interface TeacherTableProps {
  rows: TeacherView[];
}

/**
 * The teacher list, with each row expanding into everything about that teacher.
 *
 * Expansion in place rather than a detail route. Editing a room number or
 * adding an allergy note is a five-second job, usually done for several
 * teachers in a row; a detail page would make each one a navigation out and
 * back, and lose the list position every time.
 *
 * Only one row is open at a time. The panel is tall — notes, an edit form and
 * ten orders — and two of them open at once turns the list into a scroll hunt.
 */
export function TeacherTable({ rows }: TeacherTableProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div
        role="region"
        data-tour="teacher-table"
        aria-label="Teachers"
        tabIndex={0}
        className="overflow-x-auto rounded-box border border-base-300 bg-base-100"
      >
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Name</th>
            <th>Room</th>
            <th>Email</th>
            <th>Status</th>
            <th className="text-right">Notes</th>
            <th className="text-right">Orders</th>
            <th className="text-right">Spent</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <TeacherRows
              key={row.id}
              row={row}
              isOpen={openId === row.id}
              onToggle={() =>
                setOpenId((current) => (current === row.id ? null : row.id))
              }
            />
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-6 text-center opacity-70">
                No teachers yet. Add one above, or students add them at the cart.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

interface TeacherRowsProps {
  row: TeacherView;
  isOpen: boolean;
  onToggle: () => void;
}

function TeacherRows({ row, isOpen, onToggle }: TeacherRowsProps) {
  const [pending, startTransition] = useTransition();

  function toggleActive() {
    startTransition(async () => {
      await setTeacherActive({ id: row.id, active: !row.active });
    });
  }

  return (
    <>
      <tr className={row.active ? undefined : "opacity-75"}>
        <td className="font-bold">{row.name}</td>
        <td className="tabular">{row.room ?? "—"}</td>
        <td className="max-w-[18rem] truncate">
          {row.email ?? <span className="opacity-75">no email</span>}
        </td>
        <td>
          <span className={`badge badge-sm whitespace-nowrap ${row.active ? "badge-success" : "badge-ghost"}`}>
            {row.active ? "Active" : "Inactive"}
          </span>
        </td>
        <td className="text-right tabular">{row.notes.length}</td>
        <td className="text-right tabular">{row.orderCount}</td>
        <td className="text-right tabular">{formatUSD(row.totalSpentCents)}</td>
        <td>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={isOpen}
              className="btn btn-ghost btn-xs"
            >
              {isOpen ? "Close" : "Details"}
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

      {isOpen ? (
        <tr>
          <td colSpan={8} className="bg-base-200">
            <TeacherDetail row={row} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

interface TeacherDetailProps {
  row: TeacherView;
}

function TeacherDetail({ row }: TeacherDetailProps) {
  return (
    <div className="grid gap-6 py-3 lg:grid-cols-3">
      <EditTeacherForm row={row} />
      <NotesPanel row={row} />
      <RecentOrders orders={row.recentOrders} />
    </div>
  );
}

interface EditTeacherFormProps {
  row: TeacherView;
}

function EditTeacherForm({ row }: EditTeacherFormProps) {
  const [name, setName] = useState(row.name);
  const [room, setRoom] = useState(row.room ?? "");
  const [email, setEmail] = useState(row.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateTeacher({
        teacherId: row.id,
        name,
        room,
        email,
      });
      if (result.ok) {
        setSaved(true);
        return;
      }
      setError(
        result.error === "duplicate"
          ? "Another teacher already has that name in that room."
          : result.error === "not_found"
            ? "That teacher no longer exists. Reload the page."
            : "Check the name, and the email if you entered one.",
      );
    });
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <h3 className="text-sm font-extrabold uppercase opacity-75">Details</h3>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold opacity-70">Name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
          className="input input-bordered input-sm"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold opacity-70">Room</span>
        <input
          value={room}
          onChange={(event) => setRoom(event.target.value)}
          autoComplete="off"
          className="input input-bordered input-sm"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold opacity-70">Email</span>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          autoComplete="off"
          className="input input-bordered input-sm"
        />
        <span className="text-xs opacity-75">
          Empty means paper receipts only. Emailed receipts start again as soon
          as there is an address here.
        </span>
      </label>

      <button type="submit" disabled={pending} className="btn btn-primary btn-sm self-start">
        {pending ? "Saving…" : "Save details"}
      </button>

      {error ? (
        <p role="alert" className="text-sm font-bold text-error">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm font-bold text-success">
          Saved.
        </p>
      ) : null}
    </form>
  );
}

interface NotesPanelProps {
  row: TeacherView;
}

/**
 * Notes are what the student sees above the menu before taking this teacher's
 * order, so the panel says so. An administrator who knows the note will appear
 * on the cart writes "oat milk only"; one who thinks it is a private memo
 * writes something else entirely.
 */
function NotesPanel({ row }: NotesPanelProps) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ready = note.trim().length >= 2;

  function add() {
    setError(null);
    startTransition(async () => {
      const result = await addTeacherNote({ teacherId: row.id, note });
      if (result.ok) {
        setNote("");
        return;
      }
      setError("A note is between 2 and 200 characters.");
    });
  }

  function remove(index: number) {
    setError(null);
    startTransition(async () => {
      await removeTeacherNote({ teacherId: row.id, index });
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-extrabold uppercase opacity-75">
        Notes shown to the student
      </h3>

      {row.notes.length === 0 ? (
        <p className="text-sm opacity-70">No notes.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {row.notes.map((text, index) => (
            <li
              // Notes have no ids and can legitimately repeat, so position is
              // the only honest key. The list is re-rendered from the server
              // after every change, so a stale index cannot survive an edit.
              key={`${index}-${text}`}
              className="flex items-start gap-2 rounded-field bg-base-100 px-2 py-1"
            >
              <span className="flex-1 text-sm">{text}</span>
              <button
                type="button"
                onClick={() => remove(index)}
                disabled={pending}
                aria-label={`Remove note: ${text}`}
                className="btn btn-ghost btn-xs"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) add();
        }}
      >
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Oat milk only"
          aria-label={`New note for ${row.name}`}
          className="input input-bordered input-sm flex-1"
        />
        <button type="submit" disabled={!ready || pending} className="btn btn-sm">
          Add note
        </button>
      </form>

      {error ? (
        <p role="alert" className="text-sm font-bold text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface RecentOrdersProps {
  orders: TeacherOrderView[];
}

function RecentOrders({ orders }: RecentOrdersProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-extrabold uppercase opacity-75">Last 10 orders</h3>
      {orders.length === 0 ? (
        <p className="text-sm opacity-70">Nothing bought yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {orders.map((order) => (
            <li key={order.id} className="flex justify-between gap-4 text-sm">
              <span className="opacity-70">{order.when}</span>
              <span className="font-bold tabular">{formatUSD(order.totalCents)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
