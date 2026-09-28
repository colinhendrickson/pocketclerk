"use client";

/**
 * StaffCardCheck: the staff card step after "Staff card" is chosen (DESIGN.md
 * §4, BadgeModal). The student looks at the card and confirms; nothing is typed
 * and nothing is charged, since the card only stands in for payment. Rendered
 * as its own step rather than a modal so Back and focus work like every other
 * step of the order.
 */

import { IdCard } from "lucide-react";

import { BigButton } from "./big-button";
import { MoneyDisplay } from "./money-display";

export interface StaffCardCheckProps {
  teacherName: string;
  /** Integer cents, as shown on the payment screen. */
  totalCents: number;
  onConfirm: () => void;
  pending?: boolean;
  /** Shown above the button, e.g. when the order did not save. */
  error?: string | null;
}

export function StaffCardCheck({
  teacherName,
  totalCents,
  onConfirm,
  pending,
  error,
}: StaffCardCheckProps) {
  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-6 text-center">
      <span className="grid size-[150px] place-items-center rounded-full border-4 border-dashed border-info">
        <IdCard aria-hidden="true" className="size-[80px] text-info" />
      </span>
      <h2 className="text-[44px] font-extrabold leading-tight">
        Ask {teacherName} for their staff card
      </h2>
      <div>
        <p className="text-[18px] font-bold opacity-70">Total</p>
        <MoneyDisplay cents={totalCents} size="total" />
      </div>
      {error ? (
        <p role="alert" className="alert alert-warning w-full rounded-box text-[22px] font-extrabold">
          {error}
        </p>
      ) : null}
      <BigButton variant="primary" onClick={onConfirm} disabled={pending} className="w-full">
        {pending ? "Saving…" : "Card checked, done"}
      </BigButton>
    </div>
  );
}
