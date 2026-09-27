import { CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";

import { SETUP_STEP_TEXT } from "@/lib/help";
import { setupComplete, type SetupStep } from "@/lib/setup";

import { OutsideLink } from "./_help/guide-view";
import { PairingLink } from "./pairing-link";

export interface SetupChecklistProps {
  steps: SetupStep[];
  /** The link that connects the cart's iPad, or null where none is needed. */
  pairingUrl: string | null;
  adminEmail: string;
}

/**
 * "Get the cart ready" checklist. Expanded while any required step is left;
 * collapses to a reopenable summary once setup is complete.
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
              {!step.done && text.link ? <OutsideLink {...text.link} /> : null}
              {step.id === "ipad" ? (
                pairingUrl ? (
                  step.done ? (
                    // For a replacement iPad or a computer to try the cart on.
                    <details className="rounded-box bg-base-200 p-3">
                      <summary className="cursor-pointer text-sm font-bold">
                        Connect another device, such as a computer to try the cart on
                      </summary>
                      <div className="mt-2 flex flex-col gap-2">
                        <p className="text-sm">
                          Open this link on that device; on an iPad, open it in Bluefy so the
                          printer works. Anything done there is real: practice sales appear in
                          Orders and today&rsquo;s totals.
                        </p>
                        <PairingLink url={pairingUrl} email={adminEmail} />
                        {text.link ? <OutsideLink {...text.link} /> : null}
                      </div>
                    </details>
                  ) : (
                    <PairingLink url={pairingUrl} email={adminEmail} />
                  )
                ) : step.done ? null : (
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
