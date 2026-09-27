/**
 * DemoBanner: shown on every page of the public demo. "Start over" is an
 * outline button so it never competes with the screen's `btn-primary`, and is
 * 60px tall for student screens. A server-action form, so it works before
 * hydration.
 */

import { startOver } from "@/app/demo/actions";

export function DemoBanner() {
  return (
    <div
      role="region"
      aria-label="Demo"
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-neutral px-4 py-2 text-neutral-content"
    >
      <p className="text-[18px] font-bold">This is a demo. Everything resets every hour.</p>
      <form action={startOver}>
        <button type="submit" className="btn btn-outline min-h-[60px] border-neutral-content text-[18px] font-bold text-neutral-content">
          Start over
        </button>
      </form>
    </div>
  );
}
