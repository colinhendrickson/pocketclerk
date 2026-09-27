/**
 * ChangeCard: the change owed to the customer, with a denomination hint
 * (DESIGN.md §4). This is the only sanctioned use of `MoneyDisplay
 * size="change"`, the largest text in the app. The figure inherits
 * `neutral-content` from the card. The hint comes from `denominationHint` in
 * `src/lib/money.ts`; callers may override it.
 */

import { denominationHint } from "@/lib/money";
import { MoneyDisplay } from "./money-display";

export interface ChangeCardProps {
  /** Change owed, in integer cents. Computed by `changeCents`, never here. */
  changeCents: number;
  /** Sentence-case caption above the figure. */
  label?: string;
  /** Overrides the generated "3 one-dollar bills" line. */
  hint?: string;
}

export function ChangeCard({
  changeCents,
  label = "Give back",
  hint,
}: ChangeCardProps) {
  return (
    // Live region: announced on render and whenever the amount changes.
    <div role="status" aria-atomic="true" className="card bg-neutral text-neutral-content">
      {/* Size container; the change figure scales to its width. */}
      <div className="@container card-body w-full items-center gap-2 px-4 text-center md:px-8">
        <p className="text-[18px] font-bold opacity-80">{label}</p>
        <MoneyDisplay cents={changeCents} size="change" />
        <p className="text-[22px] font-extrabold">
          {hint ?? denominationHint(changeCents)}
        </p>
      </div>
    </div>
  );
}
