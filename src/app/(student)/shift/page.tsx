import { redirect } from "next/navigation";

import { cartFormatter } from "@/lib/time";
import { branding } from "@/lib/branding";
import { getActiveShift } from "@/lib/queries";
import { getShiftSession } from "@/lib/session";

import { DashboardActions } from "./dashboard-actions";
import { LiveHours } from "./live-hours";
import { PrinterBar } from "./printer-bar";
import { requirePairedDevice } from "@/app/(student)/require-device";

export const dynamic = "force-dynamic";

const SHIFT_STEPS = ["Clock in", "Take orders", "Count inventory", "Clock out"] as const;
/** On this screen the student is clocked in and taking orders. */
const CURRENT_STEP = 2;

/**
 * The employee dashboard, and the answer to "what do I do next?".
 *
 * One primary action fills the top of the screen; everything else is visibly
 * secondary. The four steps of a shift run down the left rail in order, so the
 * student can see where they are without being told.
 */
export default async function ShiftPage() {
  await requirePairedDevice();
  const shiftId = await getShiftSession();
  if (!shiftId) redirect("/cart");

  const shift = await getActiveShift(shiftId);
  // A cookie pointing at a closed or deleted shift sends the student back to
  // sign-in rather than into a screen with nothing behind it.
  if (!shift) redirect("/cart");

  const today = cartFormatter({
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  // Per DESIGN.md §3: a dark rail at lg and up, a top bar with the steps across
  // it at md, and below md a bar with only the student, the steps reduced to
  // one line of text.
  return (
    <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="flex items-center gap-4 bg-neutral px-4 py-3 text-neutral-content md:px-6 lg:flex-col lg:items-stretch lg:gap-6 lg:p-6">
        <p className="hidden text-[20px] font-extrabold md:block">{branding.cartName}</p>
        <ul className="steps steps-horizontal hidden flex-1 md:grid lg:steps-vertical lg:flex-none">
          {SHIFT_STEPS.map((label, index) => (
            <li
              key={label}
              className={`step text-[15px] font-bold lg:text-[18px] ${index < CURRENT_STEP ? "step-primary" : ""}`}
            >
              {label}
            </li>
          ))}
        </ul>
        <div className="flex min-w-0 items-center gap-3 rounded-box md:ml-auto lg:mt-auto lg:ml-0 lg:bg-base-content/10 lg:p-4">
          <span className="grid size-[48px] shrink-0 place-items-center rounded-full bg-accent text-accent-content text-[20px] font-extrabold">
            {shift.studentName.charAt(0)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[18px] font-bold">{shift.studentName}</span>
            <span className="block text-[15px] font-bold opacity-80 md:hidden">
              Step {CURRENT_STEP} of {SHIFT_STEPS.length} · {SHIFT_STEPS[CURRENT_STEP - 1]}
            </span>
          </span>
        </div>
      </aside>

      <main className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[18px] font-bold opacity-70">{today}</p>
            <h1 className="text-[44px] font-extrabold leading-tight">
              Welcome, {shift.studentName}!
            </h1>
          </div>
          <LiveHours clockInIso={shift.clockIn.toISOString()} />
        </header>

        <PrinterBar />

        <DashboardActions />
      </main>
    </div>
  );
}
