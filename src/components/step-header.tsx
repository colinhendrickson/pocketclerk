/**
 * StepHeader — where the student is, and the only way back.
 *
 * Implements the StepHeader row of the DESIGN.md §4 map: a navbar-style bar on
 * `bg-base-100 border-b border-base-300`, a 60x60 `btn btn-ghost` back control,
 * and the "Step n of 4" caption (15px, the floor for student screens per §2)
 * sitting above the 26px screen title.
 *
 * The daisyUI `steps` strip is the progress affordance at md and up. Per §3 it
 * collapses below md to the caption line alone, so the strip is `hidden md:flex`
 * while the caption always renders — the student never loses the count, and the
 * screen never scrolls sideways to keep four step labels on one row. The rail on
 * the employee dashboard uses the same strip vertically, which is what
 * `orientation` selects.
 *
 * Navigation is a `Link`, not a click handler, so this stays a server component
 * and back survives a hard reload on a school iPad.
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export interface StepHeaderProps {
  /** 1-based position in the flow. Rendered as "Step {step} of {totalSteps}". */
  step: number;
  totalSteps?: number;
  /** Sentence-case screen title, 26px. */
  title: string;
  /** Optional context line under the title, e.g. a teacher and room. */
  subtitle?: string;
  /** Where the back button goes. Omit to render the header without one. */
  backHref?: string;
  /** Accessible name for the back control; sentence case. */
  backLabel?: string;
  /** Step labels for the daisyUI `steps` strip. Steps up to `step` are marked done. */
  steps?: readonly string[];
  orientation?: "horizontal" | "vertical";
}

export function StepHeader({
  step,
  totalSteps = 4,
  title,
  subtitle,
  backHref,
  backLabel = "Go back",
  steps,
  orientation = "horizontal",
}: StepHeaderProps) {
  return (
    <header className="bg-base-100 border-b border-base-300 flex items-center gap-4 px-4 py-3">
      {backHref ? (
        <Link
          href={backHref}
          aria-label={backLabel}
          className="btn btn-ghost min-h-[60px] h-[60px] w-[60px] p-0 shrink-0"
        >
          <ArrowLeft size={34} aria-hidden="true" />
        </Link>
      ) : null}

      <div className="min-w-0">
        <p className="text-[15px] font-bold opacity-70 tabular">
          Step {step} of {totalSteps}
        </p>
        <h1 className="text-[26px] font-extrabold truncate">{title}</h1>
        {subtitle ? (
          <p className="text-[15px] font-bold opacity-70 truncate">{subtitle}</p>
        ) : null}
      </div>

      {steps ? (
        <ul
          className={`steps ${
            orientation === "vertical" ? "steps-vertical" : "steps-horizontal"
          } hidden md:flex ml-auto`}
        >
          {steps.map((label, index) => (
            <li
              key={label}
              className={`step ${index < step ? "step-primary" : ""}`}
              aria-current={index + 1 === step ? "step" : undefined}
            >
              {label}
            </li>
          ))}
        </ul>
      ) : null}
    </header>
  );
}
