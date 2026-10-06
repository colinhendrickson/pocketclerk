"use client";

import { UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { switchWorker } from "../actions";

export interface CrewPanelProps {
  /** Longest-working first, the student at the register included. */
  crew: { id: string; studentName: string }[];
  currentId: string;
}

/**
 * Who is working, on the dashboard (ticket 4.21). Another student joins with
 * Add a worker and their own PIN; once they have, one tap puts them at the
 * register. Secondary buttons only: Start classroom order stays the one
 * primary on this screen.
 */
export function CrewPanel({ crew, currentId }: CrewPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  function switchTo(shiftId: string) {
    setError(false);
    startTransition(async () => {
      const result = await switchWorker({ shiftId });
      if (!result.ok) setError(true);
      router.refresh();
    });
  }

  return (
    // One wrapping row, so Start classroom order stays in view on the iPad.
    <section
      aria-labelledby="crew-heading"
      className="flex flex-col gap-2 rounded-box border border-base-300 bg-base-100 px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="crew-heading" className="text-[18px] font-bold opacity-70">
          Working now
        </h2>
        <ul className="contents">
          {crew.map((member) =>
            member.id === currentId ? (
              <li
                key={member.id}
                aria-current="true"
                className="flex min-h-[60px] max-w-full items-center gap-3 rounded-box bg-accent px-4 text-accent-content"
              >
                <span className="truncate text-[20px] font-extrabold">{member.studentName}</span>
                <span className="shrink-0 text-[16px] font-bold">At the register</span>
              </li>
            ) : (
              <li key={member.id} className="max-w-full">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => switchTo(member.id)}
                  className="btn h-auto min-h-[60px] max-w-full rounded-box border-base-300 bg-base-100 text-[20px] font-extrabold"
                >
                  <span className="truncate">Switch to {member.studentName}</span>
                </button>
              </li>
            ),
          )}
          <li className="sm:ml-auto">
            <Link
              href="/cart"
              className="btn btn-ghost min-h-[60px] gap-2 text-[20px] font-bold"
            >
              <UserPlus aria-hidden="true" className="size-[28px]" />
              Add a worker
            </Link>
          </li>
        </ul>
      </div>
      {error ? (
        <p role="alert" className="text-[18px] font-bold text-error">
          That student has clocked out. Ask them to sign in again.
        </p>
      ) : null}
    </section>
  );
}
