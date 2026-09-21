"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BigButton } from "@/components";
import { branding } from "@/lib/branding";
import { formatHours } from "@/lib/money";

import { clockOut } from "../../actions";

export interface ClockOutFormProps {
  studentName: string;
}

interface Summary {
  hoursHundredths: number;
  tickets: number;
}

/**
 * Clock out, and the one screen that asks for confirmation.
 *
 * Ending a shift is the single destructive action a student can take: it stops
 * the clock and closes the day's record. Everything else in the flow advances
 * by itself, so the extra tap here is deliberate rather than inconsistent.
 */
export function ClockOutForm({ studentName }: ClockOutFormProps) {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pending, startTransition] = useTransition();

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
          Your shift is saved. You can close the cart now.
        </p>
        <BigButton variant="primary" onClick={() => router.replace("/")}>
          Finish
        </BigButton>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-8 text-center">
      <h1 className="text-[44px] font-extrabold">Are you done for today?</h1>
      <p className="text-[22px] font-bold opacity-70">
        Clocking out stops your hours and saves your shift.
      </p>
      <div className="flex w-full flex-col gap-4">
        <BigButton
          variant="primary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await clockOut();
              if (result.ok) {
                setSummary({
                  hoursHundredths: result.hoursHundredths,
                  tickets: result.tickets,
                });
              } else {
                router.replace("/");
              }
            })
          }
        >
          {pending ? "Saving…" : "Yes, clock out"}
        </BigButton>
        <BigButton disabled={pending} onClick={() => router.push("/shift")}>
          No, keep working
        </BigButton>
      </div>
    </div>
  );
}
