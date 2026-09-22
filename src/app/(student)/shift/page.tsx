import { redirect } from "next/navigation";

import { branding } from "@/lib/branding";
import { getActiveShift } from "@/lib/queries";
import { getShiftSession } from "@/lib/session";

import { DashboardActions } from "./dashboard-actions";
import { LiveHours } from "./live-hours";
import { PrinterBar } from "./printer-bar";

export const dynamic = "force-dynamic";

/**
 * The employee dashboard, and the answer to "what do I do next?".
 *
 * One primary action fills the top of the screen; everything else is visibly
 * secondary. The four steps of a shift run down the left rail in order, so the
 * student can see where they are without being told.
 */
export default async function ShiftPage() {
  const shiftId = await getShiftSession();
  if (!shiftId) redirect("/");

  const shift = await getActiveShift(shiftId);
  // A cookie pointing at a closed or deleted shift sends the student back to
  // sign-in rather than into a screen with nothing behind it.
  if (!shift) redirect("/");

  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="flex flex-col gap-6 bg-neutral p-6 text-neutral-content">
        <p className="text-[20px] font-extrabold">{branding.cartName}</p>
        <ul className="steps steps-vertical">
          <li className="step step-primary text-[18px] font-bold">Clock in</li>
          <li className="step step-primary text-[18px] font-bold">Take orders</li>
          <li className="step text-[18px] font-bold">Count inventory</li>
          <li className="step text-[18px] font-bold">Clock out</li>
        </ul>
        <div className="mt-auto flex items-center gap-3 rounded-box bg-base-content/10 p-4">
          <span className="grid size-[48px] place-items-center rounded-full bg-accent text-accent-content text-[20px] font-extrabold">
            {shift.studentName.charAt(0)}
          </span>
          <span className="text-[18px] font-bold">{shift.studentName}</span>
        </div>
      </aside>

      <main className="flex flex-1 flex-col gap-8 p-8">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-[18px] font-bold opacity-70">{today}</p>
            <h1 className="text-[44px] font-extrabold">Welcome, {shift.studentName}!</h1>
          </div>
          <LiveHours clockInIso={shift.clockIn.toISOString()} />
        </header>

        <PrinterBar />

        <DashboardActions />
      </main>
    </div>
  );
}
