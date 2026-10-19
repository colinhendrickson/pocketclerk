"use client";

import { useState, useTransition } from "react";

import { startNewPayPeriod } from "./actions";

export interface PayPeriodPanelProps {
  /** The current period's id, or null before the first one is started. */
  currentId: string | null;
  /** When it started, already formatted in the cart's time zone. */
  startedLabel: string | null;
}

/**
 * Pay period controls (4.23). Starting a new period asks once more first, since
 * it changes what the hours column shows for everyone. Nothing is deleted: the
 * finished period moves to Past pay periods below the roster.
 */
export function PayPeriodPanel({ currentId, startedLabel }: PayPeriodPanelProps) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function start() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await startNewPayPeriod({ previousId: currentId });
      setConfirming(false);
      if (result.ok) {
        setMessage("A new pay period has started. Hours count from now.");
        return;
      }
      setError(
        result.error === "stale"
          ? "Someone already started a new pay period. Reload the page to see it."
          : "That did not save. Reload and try again.",
      );
    });
  }

  return (
    <section data-tour="pay-period" className="card card-border bg-base-100 p-5">
      <h2 className="mb-1 text-lg font-extrabold">Pay period</h2>
      <p className="mb-3">
        {startedLabel
          ? `Shifts and hours below count from ${startedLabel}, when this pay period started.`
          : "No pay period has been started yet, so shifts and hours below count every shift so far."}
      </p>

      {confirming ? (
        <div className="flex flex-col gap-3 rounded-box bg-base-200 p-4">
          <p className="font-bold">Start a new pay period now?</p>
          <p className="text-sm">
            Shifts and hours on this page start again from zero. The hours so far are kept
            under Past pay periods, and all-time hours do not change.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={start}
              disabled={pending}
              className="btn btn-primary btn-sm"
            >
              {pending ? "Starting…" : "Yes, start a new pay period"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="btn btn-ghost btn-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => {
              setMessage(null);
              setConfirming(true);
            }}
            className="btn btn-outline btn-sm"
          >
            Start new pay period
          </button>
        </div>
      )}

      {message ? (
        <p role="status" className="mt-3 text-sm font-bold text-success">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm font-bold text-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}
