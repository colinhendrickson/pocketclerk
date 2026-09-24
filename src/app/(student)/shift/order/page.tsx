import { redirect } from "next/navigation";

import { getActiveShift, listAddons, listMenu, listTeachers } from "@/lib/queries";
import { getShiftSession } from "@/lib/session";

import { OrderFlow } from "./order-flow";
import { requirePairedDevice } from "@/app/(student)/require-device";

export const dynamic = "force-dynamic";

/**
 * Fetches everything the order needs in one round trip, then hands it to the
 * client flow. The menu does not change mid-order, so loading it once here
 * avoids a spinner between every step of a sale that should feel instant.
 */
export default async function OrderPage() {
  await requirePairedDevice();
  const shiftId = await getShiftSession();
  if (!shiftId) redirect("/cart");
  if (!(await getActiveShift(shiftId))) redirect("/cart");

  const [teachers, menu, extras] = await Promise.all([
    listTeachers(),
    listMenu(),
    listAddons(),
  ]);

  return <OrderFlow teachers={teachers} menu={menu} addons={extras} />;
}
