"use client";

import { Compass, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { TOURS, type TourStep } from "@/lib/help/tours";
import type { AdminRoute } from "@/lib/help/types";

interface LiveStep {
  step: TourStep;
  element: HTMLElement;
}

/** The first element for a step that is actually on screen at this size. */
function findTarget(target: string): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`);
  for (const element of candidates) {
    const style = getComputedStyle(element);
    if (element.getClientRects().length > 0 && style.visibility !== "hidden") return element;
  }
  return null;
}

/**
 * "Show me around": a walk through the page, one part at a time.
 *
 * Built on the native modal `<dialog>`, which traps focus, closes on Escape
 * and is announced as a dialog by screen readers without any of it being
 * rebuilt by hand. The dialog sits at the bottom of the screen with no dimming,
 * so the part being explained stays visible above it, outlined. It never opens
 * by itself: someone who knows the page should not have to dismiss it.
 *
 * Steps are declared in src/lib/help/tours.ts. A step whose target is not on
 * screen at this size is skipped, so the count never promises a step that
 * cannot be shown.
 */
export function TourButton() {
  const pathname = usePathname();
  const steps = TOURS[pathname as AdminRoute];

  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [live, setLive] = useState<LiveStep[]>([]);
  const [index, setIndex] = useState(0);
  const titleId = useId();
  const bodyId = useId();

  const current = live[index];

  // Outline the step's target and bring it into view.
  useEffect(() => {
    if (!current) return;
    const { element } = current;
    element.setAttribute("data-tour-active", "");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // To the top of the screen, not the middle: the tour card sits at the
    // bottom, and on a phone a centred section disappears behind it.
    element.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
    return () => element.removeAttribute("data-tour-active");
  }, [current]);

  // Leaving the page ends the tour.
  useEffect(() => {
    const dialog = dialogRef.current;
    return () => dialog?.close();
  }, [pathname]);

  if (!steps) return null;

  function start() {
    const found = steps
      .map((step) => ({ step, element: findTarget(step.target) }))
      .filter((entry): entry is LiveStep => entry.element !== null);
    if (found.length === 0) return;
    setLive(found);
    setIndex(0);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  const last = index === live.length - 1;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={start}
        className="btn btn-ghost btn-sm shrink-0"
      >
        <Compass size={18} aria-hidden="true" />
        {/* Short on a phone, where the full label squeezes the cart's name
            out of the header. Only one is ever displayed, so the button's
            name is always the words on it. */}
        <span className="sm:hidden">Tour</span>
        <span className="hidden sm:inline">Show me around</span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onClose={() => {
          setLive([]);
          buttonRef.current?.focus();
        }}
        className="m-0 mx-auto mt-auto mb-4 w-[min(30rem,calc(100%-2rem))] rounded-box border border-base-300 bg-base-100 p-0 text-base-content shadow-xl backdrop:bg-transparent"
      >
        {current ? (
          <div className="flex flex-col gap-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-bold opacity-75">
                Step {index + 1} of {live.length}
              </p>
              <button
                type="button"
                onClick={close}
                className="btn btn-ghost btn-sm btn-square -mt-1 -mr-2"
              >
                <X size={18} aria-hidden="true" />
                <span className="sr-only">End the tour</span>
              </button>
            </div>
            {/* Read out when it changes, since focus stays on Next. */}
            <div aria-live="polite" className="flex flex-col gap-1">
              <h2 id={titleId} className="text-lg font-extrabold">
                {current.step.title}
              </h2>
              <p id={bodyId}>{current.step.body}</p>
            </div>
            <div className="flex justify-end gap-2">
              {index > 0 ? (
                <button type="button" onClick={() => setIndex(index - 1)} className="btn btn-ghost btn-sm">
                  Back
                </button>
              ) : null}
              <button
                type="button"
                autoFocus
                onClick={() => (last ? close() : setIndex(index + 1))}
                className="btn btn-primary btn-sm"
              >
                {last ? "Done" : "Next"}
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
