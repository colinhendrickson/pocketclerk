"use client";

/**
 * StaffCardCheck: the staff card step after "Staff card" is chosen (DESIGN.md
 * §4). The student asks for the card and taps Scan card; the screen plays a
 * short "reading" pause, a register beep and Approved, then completes the sale.
 * It simulates a card reader without any hardware, so it always succeeds and
 * stays a single tap. Rendered as its own step so Back and focus work like the
 * other steps of the order.
 */

import { Check, IdCard } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BigButton } from "./big-button";
import { MoneyDisplay } from "./money-display";

/** How long the pretend reader "reads", and how long Approved shows before the sale completes. */
const READING_MS = 1200;
const APPROVED_MS = 800;

export interface StaffCardCheckProps {
  teacherName: string;
  /** Integer cents, as shown on the payment screen. */
  totalCents: number;
  onConfirm: () => void;
  pending?: boolean;
  /** Shown above the button, e.g. when the order did not save. */
  error?: string | null;
}

type Phase = "ready" | "reading" | "approved";

/** A short two-tone register beep. Silent if the browser has no Web Audio. */
function playApprovalBeep() {
  try {
    const context = new AudioContext();
    const tone = (frequency: number, start: number) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.15, context.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + start + 0.12);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + start);
      oscillator.stop(context.currentTime + start + 0.12);
    };
    tone(1320, 0);
    tone(1760, 0.13);
    setTimeout(() => void context.close(), 500);
  } catch {
    // Sound is a nicety; the screen already says Approved.
  }
}

export function StaffCardCheck({
  teacherName,
  totalCents,
  onConfirm,
  pending,
  error,
}: StaffCardCheckProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // A failed save returns the student to Scan card so they can try again.
  useEffect(() => {
    if (error) setPhase("ready");
  }, [error]);

  function scan() {
    setPhase("reading");
    timers.current.push(
      setTimeout(() => {
        setPhase("approved");
        playApprovalBeep();
        timers.current.push(setTimeout(onConfirm, APPROVED_MS));
      }, READING_MS),
    );
  }

  const approved = phase === "approved";

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-6 text-center">
      <span
        className={`grid size-[150px] place-items-center rounded-full border-4 ${
          approved
            ? "border-solid border-success bg-success/10"
            : `border-dashed border-info ${phase === "reading" ? "motion-safe:animate-pulse" : ""}`
        }`}
      >
        {approved ? (
          <Check aria-hidden="true" className="size-[80px] text-success" />
        ) : (
          <IdCard aria-hidden="true" className="size-[80px] text-info" />
        )}
      </span>
      <h2 className="text-[44px] font-extrabold leading-tight">
        {approved ? "Approved" : `Ask ${teacherName} for their staff card`}
      </h2>
      <p role="status" className="min-h-[1.5em] text-[22px] font-bold">
        {phase === "reading" ? "Reading card…" : approved ? "Card approved." : ""}
      </p>
      <div>
        <p className="text-[18px] font-bold opacity-70">Total</p>
        <MoneyDisplay cents={totalCents} size="total" />
      </div>
      {error ? (
        <p role="alert" className="alert alert-warning w-full rounded-box text-[22px] font-extrabold">
          {error}
        </p>
      ) : null}
      {phase === "ready" ? (
        <BigButton variant="primary" onClick={scan} disabled={pending} className="w-full">
          Scan card
        </BigButton>
      ) : null}
    </div>
  );
}
