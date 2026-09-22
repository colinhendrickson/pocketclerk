"use client";

import { Delete } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { clockIn } from "../../actions";

const PIN_LENGTH = 4;

export interface PinFormProps {
  studentId: string;
  studentName: string;
}

/**
 * PIN entry.
 *
 * The keypad is local rather than the device keyboard: a software keyboard
 * covers half an iPad screen, offers autocorrect and emoji, and is a much
 * larger surface than four digits needs.
 *
 * Entry submits itself on the fourth digit. There is no confirm button, because
 * a second deliberate action after an already-deliberate four taps is a step
 * that only exists to be forgotten.
 */
export function PinForm({ studentId, studentName }: PinFormProps) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(value: string) {
    startTransition(async () => {
      const result = await clockIn({ studentId, pin: value });
      if (result.ok) {
        router.replace("/shift");
        return;
      }
      setPin("");
      if (result.error === "wrong_pin") {
        setMessage(
          result.attemptsRemaining === 1
            ? "That PIN was not right. One more try before it locks."
            : `That PIN was not right. ${result.attemptsRemaining} tries left.`,
        );
      } else if (result.error === "locked_out") {
        setMessage(
          `Too many tries. Ask a teacher for help, or try again in ${result.minutesRemaining} minutes.`,
        );
      } else {
        setMessage("Something went wrong. Ask a teacher for help.");
      }
    });
  }

  function press(digit: string) {
    if (pending || pin.length >= PIN_LENGTH) return;
    const next = pin + digit;
    setMessage(null);
    setPin(next);
    if (next.length === PIN_LENGTH) submit(next);
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <h1 className="text-[44px] font-extrabold">Hi {studentName}, enter your PIN</h1>

      <div className="flex gap-4" role="status" aria-label={`${pin.length} of 4 digits entered`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            className={`size-[60px] rounded-box border-2 ${
              i < pin.length ? "border-primary bg-primary" : "border-base-300 bg-base-100"
            }`}
          />
        ))}
      </div>

      {message ? (
        // A stable id, because "the element with role=alert" is ambiguous: the
        // framework renders its own live region for route announcements, and on
        // this page that region reads "enter your PIN", which matches anything
        // looking for the word.
        <p
          id="pin-error"
          role="alert"
          className="alert alert-warning rounded-box text-[22px] font-extrabold"
        >
          {message}
        </p>
      ) : null}

      <div className="grid grid-cols-3 gap-4">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={pending}
            onClick={() => press(digit)}
            className="btn size-[92px] rounded-box bg-base-100 text-[34px] font-extrabold tabular"
          >
            {digit}
          </button>
        ))}
        <span />
        <button
          type="button"
          disabled={pending}
          onClick={() => press("0")}
          className="btn size-[92px] rounded-box bg-base-100 text-[34px] font-extrabold tabular"
        >
          0
        </button>
        <button
          type="button"
          disabled={pending || pin.length === 0}
          onClick={() => {
            setMessage(null);
            setPin(pin.slice(0, -1));
          }}
          aria-label="Delete last digit"
          className="btn size-[92px] rounded-box bg-base-300"
        >
          <Delete size={34} aria-hidden="true" />
        </button>
      </div>

      {pending ? <p className="text-[20px] font-bold">Checking…</p> : null}
    </div>
  );
}
