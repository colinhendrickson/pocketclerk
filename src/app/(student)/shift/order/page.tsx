import { redirect } from "next/navigation";

import { getActiveShift, listAddons, listMenu, listTeachers } from "@/lib/queries";
import { getShiftSession } from "@/lib/session";
import { cardPaymentsEnabled } from "@/lib/settings";

import { OrderFlow } from "./order-flow";
import { requirePairedDevice } from "@/app/(student)/require-device";

export const dynamic = "force-dynamic";

/**
 * Loads everything the order flow needs up front so steps within a sale never
 * wait on the network.
 */
export default async function OrderPage() {
  await requirePairedDevice();
  const shiftId = await getShiftSession();
  if (!shiftId) redirect("/cart");
  if (!(await getActiveShift(shiftId))) redirect("/cart");

  const [teachers, menu, extras, cardEnabled] = await Promise.all([
    listTeachers(),
    listMenu(),
    listAddons(),
    cardPaymentsEnabled(),
  ]);

  return (
    <OrderFlow teachers={teachers} menu={menu} addons={extras} cardPaymentsEnabled={cardEnabled} />
  );
}
