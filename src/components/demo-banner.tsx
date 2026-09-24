/**
 * DemoBanner — tells every visitor to the public demo that it is one.
 *
 * On every page of the demo, the landing page included, so nobody mistakes the
 * shared, made-up cart for a real one or expects their changes to last. Start
 * over is a plain outline button, never `btn-primary`, so the screen's one
 * primary action stays the screen's own; it is 60px tall because the banner
 * also sits on student screens.
 *
 * A server component: the form posts to a server action, so it works before
 * the page has hydrated.
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
