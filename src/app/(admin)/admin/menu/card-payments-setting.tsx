"use client";

import { useState, useTransition } from "react";

import { saveCardPayments } from "./actions";

export interface CardPaymentsSettingProps {
  enabled: boolean;
}

/**
 * The site-wide switch for staff card payments (3.7). Saves on change; the
 * whole label is the touch target so it clears 44px.
 */
export function CardPaymentsSetting({ enabled }: CardPaymentsSettingProps) {
  const [checked, setChecked] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function change(next: boolean) {
    setError(null);
    setChecked(next);
    startTransition(async () => {
      const result = await saveCardPayments(next);
      if (!result.ok) {
        setChecked(!next);
        setError("That did not save. Try again.");
      }
    });
  }

  return (
    <section
      data-tour="card-payments"
      aria-labelledby="card-payments-heading"
      className="flex flex-col gap-3"
    >
      <header>
        <h2 id="card-payments-heading" className="text-lg font-extrabold">
          How teachers pay
        </h2>
        <p className="text-sm opacity-70">
          Students ask for the teacher&apos;s staff ID card and check it, instead
          of making change. Cash is always available.
        </p>
      </header>

      <div className="flex flex-col gap-2 rounded-box border border-base-300 bg-base-100 p-4">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 self-start">
          <input
            type="checkbox"
            role="switch"
            className="toggle toggle-primary"
            checked={checked}
            disabled={pending}
            onChange={(event) => change(event.target.checked)}
          />
          <span className="font-bold">Let teachers pay with a staff card</span>
        </label>

        {error ? (
          <p role="alert" className="text-sm font-bold text-error">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
