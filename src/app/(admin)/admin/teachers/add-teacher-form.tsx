"use client";

import { useState, useTransition } from "react";

import { addTeacher } from "./actions";

/**
 * Adding a teacher ahead of time.
 *
 * The email is optional, as it is at the cart, but the hint says plainly what
 * leaving it out costs: no emailed receipts. That is the question staff would
 * otherwise have to ask.
 */
export function AddTeacherForm() {
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ready = name.trim().length >= 2;

  function submit() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await addTeacher({ name, room, email });
      if (result.ok) {
        setMessage(`${result.name} is on the list. Students can pick them at the cart now.`);
        setName("");
        setRoom("");
        setEmail("");
        return;
      }
      setError(
        result.error === "duplicate"
          ? "A teacher with that name is already listed for that room."
          : "Check the name (at least two letters) and that the email has an @ in it.",
      );
    });
  }

  return (
    <section className="card card-border bg-base-100 p-5" aria-labelledby="add-teacher-heading">
      <h2 id="add-teacher-heading" className="mb-3 text-lg font-extrabold">
        Add a teacher
      </h2>

      <form
        className="flex flex-wrap items-start gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) submit();
        }}
      >
        <label htmlFor="new-teacher-name" className="flex flex-col gap-1">
          <span className="text-sm font-bold opacity-70">Name</span>
          <input
            id="new-teacher-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
            aria-describedby="new-teacher-name-hint"
            className="input input-bordered input-sm w-56"
          />
          <span id="new-teacher-name-hint" className="text-sm opacity-70">
            As students say it, e.g. Mrs. Lopez.
          </span>
        </label>

        <label htmlFor="new-teacher-room" className="flex flex-col gap-1">
          <span className="text-sm font-bold opacity-70">Room (optional)</span>
          <input
            id="new-teacher-room"
            value={room}
            onChange={(event) => setRoom(event.target.value)}
            autoComplete="off"
            className="input input-bordered input-sm w-24"
          />
        </label>

        <label htmlFor="new-teacher-email" className="flex flex-col gap-1">
          <span className="text-sm font-bold opacity-70">Email (optional)</span>
          <input
            id="new-teacher-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="off"
            aria-describedby="new-teacher-email-hint"
            className="input input-bordered input-sm w-64"
          />
          <span id="new-teacher-email-hint" className="max-w-64 text-sm opacity-70">
            Receipts are emailed here. Leave it blank and this teacher gets no
            receipts until you add one.
          </span>
        </label>

        <button
          type="submit"
          disabled={!ready || pending}
          className="btn btn-primary btn-sm mt-6"
        >
          {pending ? "Adding…" : "Add teacher"}
        </button>
      </form>

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
