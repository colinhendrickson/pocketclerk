import { redirect } from "next/navigation";

import { othersWorking } from "@/lib/crew";
import { getChecklist } from "@/lib/inventory";
import { getFinishedShift } from "@/lib/queries";
import { getShiftSession } from "@/lib/session";
import { loadCrew } from "@/app/(student)/crew-session";

import { ClockOutForm } from "./clock-out-form";
import { requirePairedDevice } from "@/app/(student)/require-device";

export const dynamic = "force-dynamic";

/**
 * The end-of-shift checklist while the shift is open, then the earnings
 * summary once closed. The summary is read from the shift so it survives a
 * refresh.
 *
 * Only the last student working closes the cart, so only they get the
 * checklist; anyone leaving earlier just clocks out (ticket 4.21).
 */
export default async function ClockOutPage() {
  await requirePairedDevice();
  const shiftId = await getShiftSession();
  if (!shiftId) redirect("/cart");

  const { current: shift, crew } = await loadCrew();
  const stillWorking = othersWorking(crew, shiftId).map((member) => member.studentName);

  if (!shift) {
    const finished = await getFinishedShift(shiftId);
    if (!finished) redirect("/cart");
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <ClockOutForm
          studentName={finished.studentName}
          initialDone={[]}
          stillWorking={stillWorking}
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
      <ClockOutForm studentName={shift.studentName} initialDone={done} stillWorking={stillWorking} />
    </main>
  );
}
