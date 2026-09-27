"use client";

/**
 * StepHeader: step caption, screen title (the page's `h1`), and back control
 * (DESIGN.md §4). The daisyUI `steps` strip shows at md and up; below md only
 * the "Step n of m" caption remains (§3). Prefer `backHref` over `onBack` so
 * back works after a hard reload.
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export interface StepHeaderProps {
  /** 1-based position in the flow. */
  step: number;
  totalSteps?: number;
  /** Sentence-case screen title. */
  title: string;
  /** Context line under the title, e.g. a teacher and room. */
  subtitle?: string;
  /** Back link target. Omit both this and `onBack` for no back control. */
  backHref?: string;
  /** For flows whose step lives in client state. Ignored when `backHref` is set. */
  onBack?: () => void;
  /** Accessible name for the back control. */
  backLabel?: string;
  /** Labels for the `steps` strip; steps up to `step` are marked done. */
  steps?: readonly string[];
  orientation?: "horizontal" | "vertical";
}

export function StepHeader({
  step,
  totalSteps = 4,
  title,
  subtitle,
  backHref,
  onBack,
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
      ) : onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          className="btn btn-ghost min-h-[60px] h-[60px] w-[60px] p-0 shrink-0"
        >
          <ArrowLeft size={34} aria-hidden="true" />
        </button>
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
