"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BigButton } from "@/components";
import { branding } from "@/lib/branding";
import { listNames } from "@/lib/crew";
import { CHECKLIST } from "@/lib/inventory-rules";
import { formatHours } from "@/lib/money";

import { clockOut, finishShift } from "../../actions";
import { toggleChecklistItem } from "../../inventory-actions";

export interface ClockOutFormProps {
  studentName: string;
  initialDone: string[];
  /**
   * Others still clocked in on this iPad. While anyone is, this student just
   * clocks out; the last one to leave does the closing list (ticket 4.21).
   */
  stillWorking?: string[];
  /** Present once the shift is closed; the screen becomes a summary. */
  finished?: Summary;
}

interface Summary {
  hoursHundredths: number;
  tickets: number;
}

/**
 * The end-of-shift checklist, then clocking out. Clock out stays disabled until
 * every task is checked. Each check saves immediately so progress survives
 * interruptions. A student leaving while others keep working skips the list.
 */
export function ClockOutForm({
  studentName,
  initialDone,
  stillWorking = [],
  finished,
}: ClockOutFormProps) {
  const router = useRouter();
  const [done, setDone] = useState<string[]>(initialDone);
  const [summary, setSummary] = useState<Summary | null>(finished ?? null);
  const [pending, startTransition] = useTransition();

  const closingUp = stillWorking.length === 0;
  const others = listNames(stillWorking);
  const othersVerb = stillWorking.length === 1 ? "is" : "are";
  const allDone = !closingUp || CHECKLIST.every((entry) => done.includes(entry.key));

  function toggle(key: string) {
    const next = !done.includes(key);
    setDone((current) =>
      next ? [...current, key] : current.filter((k) => k !== key),
    );
    startTransition(async () => {
      const result = await toggleChecklistItem(key, next);
      if (result.ok) setDone(result.done);
      else if (result.error === "no_shift") router.replace("/cart");
    });
  }

  if (summary) {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-[44px] font-extrabold">Nice work, {studentName}!</h1>
        <div className="stats rounded-box border border-base-300 bg-base-100">
          <div className="stat">
            <span className="stat-title text-[18px] font-bold">Hours worked</span>
            <span className="stat-value tabular">
              {formatHours(summary.hoursHundredths)}
            </span>
          </div>
          <div className="stat">
            <span className="stat-title text-[18px] font-bold">
              {branding.rewardName} earned
            </span>
            <span className="stat-value tabular">{summary.tickets}</span>
          </div>
        </div>
        <p className="text-[20px] font-bold opacity-70">
          {closingUp
            ? "Your shift is saved. You can close the cart now."
            : `Your shift is saved. ${others} ${othersVerb} still working.`}
        </p>
        <BigButton
          variant="primary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const { next } = await finishShift();
              router.replace(next);
            })
          }
        >
          Finish
        </BigButton>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-8">
      <h1 className="text-[44px] font-extrabold">
        {closingUp ? "Before you clock out" : "Ready to clock out?"}
      </h1>

      {closingUp ? null : (
        <p className="text-[22px] font-bold">
          {others} {othersVerb} still working, so the last one to clock out does the closing
          list.
        </p>
      )}

      {closingUp ? (
        <ul className="flex flex-col gap-3">
          {CHECKLIST.map((entry) => {
            const checked = done.includes(entry.key);
            return (
              <li key={entry.key}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  disabled={pending}
                  onClick={() => toggle(entry.key)}
                  className={`btn min-h-[72px] w-full justify-start gap-4 rounded-box text-[22px] font-extrabold ${
                    checked
                      ? "btn-success"
                      : "border-base-300 bg-base-100"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`grid size-[40px] shrink-0 place-items-center rounded-field border-2 ${
                      checked ? "border-success-content" : "border-base-300"
                    }`}
                  >
                    {checked ? <Check size={28} /> : null}
                  </span>
                  {entry.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="flex flex-col gap-4">
        <BigButton
          variant="primary"
          disabled={!allDone || pending}
          onClick={() =>
            startTransition(async () => {
              const result = await clockOut();
              if (result.ok) {
                setSummary({
                  hoursHundredths: result.hoursHundredths,
                  tickets: result.tickets,
                });
              } else {
                router.replace("/cart");
              }
            })
          }
        >
          {pending
            ? "Saving…"
            : allDone
              ? "Clock out"
              : "Finish the list above first"}
        </BigButton>
        <BigButton disabled={pending} onClick={() => router.push("/shift")}>
          Back to your shift
        </BigButton>
      </div>
    </div>
  );
}
