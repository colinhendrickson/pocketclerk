"use client";

import { useState, useTransition } from "react";

import { createStudent } from "./actions";

export interface AddStudentFormProps {
  /** Rendered above the fields, so the card carries its own heading. */
  heading: string;
}

/**
 * Adding a student to the roster.
 *
 * A client component because the PIN field has to be cleared the instant the
 * save succeeds. A plain `<form action={...}>` would leave four digits sitting
 * on screen in a school office, and the browser would offer to remember them.
 *
 * The PIN is typed twice. It is the only credential in the system and the
 * student it belongs to is not present to test it, so the cost of a typo is a
 * child who cannot clock in and does not know why.
 */
export function AddStudentForm({ heading }: AddStudentFormProps) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const mismatch = confirmPin.length === 4 && pin !== confirmPin;
  const ready = name.trim().length >= 2 && /^\d{4}$/.test(pin) && pin === confirmPin;

  function submit() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await createStudent({ displayName: name, pin });
      if (result.ok) {
        setMessage(`${name.trim()} can now sign in with that PIN.`);
        setName("");
        setPin("");
        setConfirmPin("");
        return;
      }
      setError(
        result.error === "duplicate"
          ? "A student with that name is already on the roster."
          : "Check the name and make sure the PIN is four digits.",
      );
    });
  }

  return (
    <section className="card card-border bg-base-100 p-5">
      <h2 className="mb-3 text-lg font-extrabold">{heading}</h2>

      <form
        className="flex flex-wrap items-start gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) submit();
        }}
      >
        <label htmlFor="new-student-name" className="flex flex-col gap-1">
          <span className="text-sm font-bold opacity-70">Name</span>
          <input
            id="new-student-name"
            name="displayName"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
            className="input input-bordered input-sm w-56"
          />
        </label>

        <label htmlFor="new-student-pin" className="flex flex-col gap-1">
          <span className="text-sm font-bold opacity-70">PIN</span>
          <input
            id="new-student-pin"
            name="pin"
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            // Off, not "new-password": the browser must not save or suggest a
            // credential that belongs to someone other than the person typing.
            autoComplete="off"
            aria-describedby="new-student-pin-hint"
            className="input input-bordered input-sm w-24 tabular"
          />
          <span id="new-student-pin-hint" className="max-w-40 text-sm opacity-70">
            Four digits. It cannot be shown again, so tell the student now.
          </span>
        </label>

        <label htmlFor="new-student-pin-confirm" className="flex flex-col gap-1">
          <span className="text-sm font-bold opacity-70">Repeat PIN</span>
          <input
            id="new-student-pin-confirm"
            name="pinConfirm"
            value={confirmPin}
            onChange={(event) =>
              setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 4))
            }
            inputMode="numeric"
            autoComplete="off"
            aria-invalid={mismatch}
            aria-describedby={mismatch ? "new-student-pin-mismatch" : undefined}
            className={`input input-bordered input-sm w-24 tabular ${
              mismatch ? "input-error" : ""
            }`}
          />
        </label>

        <button type="submit" disabled={!ready || pending} className="btn btn-primary btn-sm mt-6">
          {pending ? "Adding…" : "Add student"}
        </button>
      </form>

      {mismatch ? (
        <p id="new-student-pin-mismatch" role="alert" className="mt-3 text-sm font-bold text-error">
          The two PINs do not match.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="alert alert-warning mt-3 rounded-box py-2 text-sm">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="alert alert-success mt-3 rounded-box py-2 text-sm">
          {message}
        </p>
      ) : null}
    </section>
  );
}
