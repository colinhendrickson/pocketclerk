/**
 * NoteBanner: a teacher's order note shown to the student (DESIGN.md §4).
 * Notes often carry allergies or substitutions, so the banner is never
 * collapsible or hidden at any width (§3) and has no open/close state.
 * `role="alert"` announces it on render.
 */

import { TriangleAlert } from "lucide-react";

export interface NoteBannerProps {
  /** Teacher-entered note text, rendered verbatim. */
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
