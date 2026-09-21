import { redirect } from "next/navigation";

import { getActiveShift } from "@/lib/queries";
import { getShiftSession } from "@/lib/session";

import { ClockOutForm } from "./clock-out-form";

export const dynamic = "force-dynamic";

export default async function ClockOutPage() {
  const shiftId = await getShiftSession();
  if (!shiftId) redirect("/");

  const shift = await getActiveShift(shiftId);
  if (!shift) redirect("/");

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <ClockOutForm studentName={shift.studentName} />
    </main>
  );
}
