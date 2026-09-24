import { redirect } from "next/navigation";

import { getChecklist } from "@/lib/inventory";
import { getActiveShift, getFinishedShift } from "@/lib/queries";
import { getShiftSession } from "@/lib/session";

import { ClockOutForm } from "./clock-out-form";
import { requirePairedDevice } from "@/app/(student)/require-device";

export const dynamic = "force-dynamic";

/**
 * Two states behind one route.
 *
 * While the shift is open this is the end-of-shift checklist. Once it is closed
 * it is the summary of what the student earned, which survives a refresh
 * because it is read from the shift rather than held in component state.
 */
export default async function ClockOutPage() {
  await requirePairedDevice();
  const shiftId = await getShiftSession();
  if (!shiftId) redirect("/cart");

  const shift = await getActiveShift(shiftId);

  if (!shift) {
    const finished = await getFinishedShift(shiftId);
    if (!finished) redirect("/cart");
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <ClockOutForm
          studentName={finished.studentName}
          initialDone={[]}
          finished={{
            hoursHundredths: finished.hoursHundredths,
            tickets: finished.rewardTickets,
          }}
        />
      </main>
    );
  }

  const done = await getChecklist(shift.id);

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <ClockOutForm studentName={shift.studentName} initialDone={done} />
    </main>
  );
}
