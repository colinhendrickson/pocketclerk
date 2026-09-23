import { CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";

import { SETUP_STEP_TEXT } from "@/lib/help";
import { setupComplete, type SetupStep } from "@/lib/setup";

import { PairingLink } from "./pairing-link";

export interface SetupChecklistProps {
  steps: SetupStep[];
  /** The link that connects the cart's iPad, or null where none is needed. */
  pairingUrl: string | null;
  adminEmail: string;
}

/**
 * "Get the cart ready": what is done, what is left, and how to do each.
 *
 * Open while anything required is left. Once it is all done it folds down to a
 * single line that can be reopened, so it stops taking up the page but is
 * still there for the next person who wonders how the cart was set up.
 */
export function SetupChecklist({ steps, pairingUrl, adminEmail }: SetupChecklistProps) {
  const required = steps.filter((step) => !step.optional);
  const doneCount = required.filter((step) => step.done).length;
  const complete = setupComplete(steps);

  const list = (
    <ol className="flex flex-col gap-3">
      {steps.map((step) => {
        const text = SETUP_STEP_TEXT[step.id];
        return (
          <li
            key={step.id}
            className={`flex gap-3 rounded-box border p-4 ${
              step.done ? "border-base-300 bg-base-100" : "border-info/50 bg-base-100"
            }`}
          >
            {step.done ? (
              <CheckCircle2 size={24} aria-hidden="true" className="mt-0.5 shrink-0 text-success" />
            ) : (
              <Circle size={24} aria-hidden="true" className="mt-0.5 shrink-0 opacity-75" />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="font-extrabold">
                {text.title}
                <span className="sr-only">{step.done ? " (done)" : " (to do)"}</span>
              </p>
              <p className="text-sm font-bold opacity-75">{step.status}</p>
              {!step.done ? <p className="max-w-prose">{text.why}</p> : null}
              {!step.done && step.id === "ipad" ? (
                pairingUrl ? (
                  <PairingLink url={pairingUrl} email={adminEmail} />
                ) : (
                  <p className="text-sm">
                    This site does not require connecting a device: any browser can open the cart.
                  </p>
                )
              ) : null}
              {!step.done ? (
                <div className="flex flex-wrap gap-2">
                  {text.action ? (
                    <Link href={text.action.href} className="btn btn-primary btn-sm">
                      {text.action.label}
                    </Link>
                  ) : null}
                  <a href={`#guide-${text.guide}`} className="btn btn-ghost btn-sm">
                    How to do this
                  </a>
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );

  if (complete) {
    return (
      <details data-tour="setup" className="rounded-box border border-base-300 bg-base-100">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 py-2 font-extrabold">
          <CheckCircle2 size={20} aria-hidden="true" className="text-success" />
          The cart is set up. Show the setup checklist
        </summary>
        <div className="px-4 pb-4">{list}</div>
      </details>
    );
  }

  return (
    <section data-tour="setup" aria-labelledby="setup-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="setup-heading" className="text-xl font-extrabold">
          Get the cart ready
        </h2>
        <p className="text-sm font-bold">
          {doneCount} of {required.length} done
        </p>
      </div>
      <progress
        className="progress progress-success w-full"
        value={doneCount}
        max={required.length}
        aria-label="Setup progress"
      />
      {list}
    </section>
  );
}
