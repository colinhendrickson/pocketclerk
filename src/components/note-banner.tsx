/**
 * NoteBanner — the teacher's note about an order, shown to the student.
 *
 * Implements the NoteBanner row of the DESIGN.md §4 map: `alert alert-warning`
 * with `role="alert"`, a 32px Lucide `triangle-alert`, and 22px/800 text off the
 * §2 scale.
 *
 * Two rules here are structural rather than cosmetic, and both come from §3's
 * order-builder breakpoint notes: the banner sits directly under the StepHeader
 * at every width, and it is never collapsible and never hidden on small screens.
 * A note usually carries an allergy or a substitution, so there is no width at
 * which hiding it behind a tap is acceptable. This component therefore exposes
 * no open/close state — placement is the caller's only decision.
 *
 * `role="alert"` makes a screen reader announce the note when the order builder
 * renders, which matches the visual weight it is given.
 */

import { TriangleAlert } from "lucide-react";

export interface NoteBannerProps {
  /** The note text. Free-text typed by a teacher, rendered verbatim. */
  children: React.ReactNode;
}

export function NoteBanner({ children }: NoteBannerProps) {
  return (
    <div role="alert" className="alert alert-warning rounded-box items-start">
      <TriangleAlert size={32} aria-hidden="true" className="shrink-0" />
      <span className="text-[22px] font-extrabold">{children}</span>
    </div>
  );
}
