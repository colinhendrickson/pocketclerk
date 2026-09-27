import { redirect } from "next/navigation";

import { StepHeader } from "@/components";
import { openCount } from "@/lib/inventory";
import { getActiveShift } from "@/lib/queries";
import { getShiftSession } from "@/lib/session";

import { InventorySheet } from "./inventory-sheet";
import { requirePairedDevice } from "@/app/(student)/require-device";

export const dynamic = "force-dynamic";

/**
 * End-of-shift inventory. The first visit creates count rows snapshotting each
 * item's starting quantity; later visits keep existing counts.
 */
export default async function InventoryPage() {
  await requirePairedDevice();
  const shiftId = await getShiftSession();
  if (!shiftId) redirect("/cart");

  const shift = await getActiveShift(shiftId);
  if (!shift) redirect("/cart");

  const rows = await openCount(shift.id);

  return (
    <div className="flex flex-1 flex-col">
      <StepHeader
        step={3}
        totalSteps={4}
        title="Count the inventory"
        backHref="/shift"
        backLabel="Back to your shift"
        steps={["Clock in", "Take orders", "Inventory", "Clock out"]}
      />
      <InventorySheet initialRows={rows} />
    </div>
  );
}
