"use client";

import { useState, useTransition } from "react";

import { giveAccess, removeAccess } from "./actions";

export interface AdminView {
  personId: string;
  name: string;
  email: string | null;
  addedByName: string | null;
  since: string;
}

export interface AdminAccessProps {
  admins: AdminView[];
  meId: string;
  signInUrl: string;
}

/**
 * The admin list and the form to add to it.
 *
 * Removing asks for confirmation in place, as a second button, rather than
 * with the browser's confirm box, which a screen reader handles poorly and
 * which some school browsers block.
 */
export function AdminAccess({ admins, meId, signInUrl }: AdminAccessProps) {
  return (
    <>
      <GiveAccessForm signInUrl={signInUrl} />

      <section data-tour="admin-list" aria-labelledby="admins-heading" className="flex flex-col gap-3">
        <h2 id="admins-heading" className="text-lg font-extrabold">
          Who has access
        </h2>
        <ul className="flex flex-col gap-3">
          {admins.map((admin) => (
            <AdminRow
              key={admin.personId}
              admin={admin}
              isMe={admin.personId === meId}
              isLast={admins.length === 1}
            />
          ))}
        </ul>
      </section>
    </>
  );
}

function GiveAccessForm({ signInUrl }: { signInUrl: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ready = name.trim().length >= 2 && email.includes("@");

  function submit() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await giveAccess({ name, email });
      if (result.ok) {
        setMessage(
          `Done. Tell ${name.trim()} to go to ${signInUrl} and enter ${email.trim().toLowerCase()}. A code will be emailed to them.`,
        );
        setName("");
        setEmail("");
        return;
      }
      setError(
        result.error === "already"
          ? "That address already has access."
          : "Check the name (at least two letters) and the email address.",
      );
    });
  }

  return (
    <section data-tour="give-access" className="card card-border bg-base-100 p-5" aria-labelledby="give-access-heading">
      <h2 id="give-access-heading" className="mb-3 text-lg font-extrabold">
        Give someone access
      </h2>
      <form
        className="flex flex-wrap items-start gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) submit();
        }}
      >
        <label htmlFor="new-admin-name" className="flex flex-col gap-1">
          <span className="text-sm font-bold opacity-70">Name</span>
          <input
            id="new-admin-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
            className="input input-bordered input-sm w-56"
          />
        </label>
        <label htmlFor="new-admin-email" className="flex flex-col gap-1">
          <span className="text-sm font-bold opacity-70">School email</span>
          <input
            id="new-admin-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="off"
            aria-describedby="new-admin-email-hint"
            className="input input-bordered input-sm w-64"
          />
          <span id="new-admin-email-hint" className="max-w-64 text-sm opacity-70">
            The address they read. Their sign-in code is sent here.
          </span>
        </label>
        <button type="submit" disabled={!ready || pending} className="btn btn-primary btn-sm mt-6">
          {pending ? "Adding…" : "Give access"}
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

function AdminRow({ admin, isMe, isLast }: { admin: AdminView; isMe: boolean; isLast: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await removeAccess(admin.personId);
      if (result.ok) return;
      setConfirming(false);
      setError(
        result.error === "last"
          ? "This is the only admin left, so their access stays. Add someone else first."
          : result.error === "self"
            ? "You cannot remove your own access. Ask another admin to do it."
            : "That person no longer has access.",
      );
    });
  }

  const reason = isMe
    ? "This is you. Another admin can remove your access."
    : isLast
      ? "The only admin cannot be removed."
      : null;

  return (
    <li className="card card-border bg-base-100 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-extrabold">
            {admin.name}
            {isMe ? <span className="badge badge-ghost ml-2 whitespace-nowrap">You</span> : null}
          </p>
          <p className="break-all text-sm opacity-70">{admin.email ?? "No email"}</p>
          <p className="text-sm opacity-70">
            Since {admin.since}
            {admin.addedByName ? `, added by ${admin.addedByName}` : ""}
          </p>
        </div>

        {reason ? (
          <p className="text-sm opacity-70">{reason}</p>
        ) : confirming ? (
          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label={`Remove ${admin.name}?`}
          >
            <span className="text-sm font-bold">Remove {admin.name}&rsquo;s access?</span>
            <button type="button" onClick={remove} disabled={pending} className="btn btn-error btn-sm">
              {pending ? "Removing…" : "Yes, remove"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="btn btn-ghost btn-sm">
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="btn btn-outline btn-sm">
            Remove access
          </button>
        )}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm font-bold text-error">
          {error}
        </p>
      ) : null}
    </li>
  );
}
