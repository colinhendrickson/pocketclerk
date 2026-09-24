import { redirect } from "next/navigation";

import { cartFormatter } from "@/lib/time";
import { StepHeader } from "@/components";
import { formatUSD } from "@/lib/money";
import { getActiveShift, getShiftTotals, listShiftOrders } from "@/lib/queries";
import { getShiftSession } from "@/lib/session";
import { requirePairedDevice } from "@/app/(student)/require-device";

export const dynamic = "force-dynamic";

/**
 * Every order completed during this shift, plus the two totals.
 *
 * The client's specification calls this out as business-math practice, so the
 * count and the running sales are the point of the screen rather than a footer
 * detail.
 */
export default async function TodaysOrdersPage() {
  await requirePairedDevice();
  const shiftId = await getShiftSession();
  if (!shiftId) redirect("/cart");

  const shift = await getActiveShift(shiftId);
  if (!shift) redirect("/cart");

  const [rows, totals] = await Promise.all([
    listShiftOrders(shift.id),
    getShiftTotals(shift.id),
  ]);

  const time = cartFormatter({
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-1 flex-col">
      <StepHeader
        step={1}
        totalSteps={1}
        title="Today's orders"
        backHref="/shift"
        backLabel="Back to your shift"
      />

      <main className="flex flex-1 flex-col gap-6 p-6">
        {rows.length === 0 ? (
          <p className="text-[22px] font-bold opacity-70">
            No orders yet this shift.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between rounded-box border border-base-300 bg-base-100 p-4"
              >
                <span className="flex flex-col">
                  <span className="text-[22px] font-extrabold">{row.teacherName}</span>
                  <span className="text-[18px] font-bold opacity-70">
                    {row.room ? `Room ${row.room} · ` : ""}
                    <span className="tabular">{time.format(row.createdAt)}</span>
                  </span>
                </span>
                <span className="text-[26px] font-extrabold tabular">
                  {formatUSD(row.totalCents)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto grid grid-cols-2 gap-4 rounded-box border border-base-300 bg-base-100 p-6">
          <div>
            <p className="text-[18px] font-bold opacity-70">Total orders</p>
            <p className="text-[44px] font-extrabold tabular">{totals.orderCount}</p>
          </div>
          <div>
            <p className="text-[18px] font-bold opacity-70">Total sales</p>
            <p className="text-[44px] font-extrabold tabular">
              {formatUSD(totals.salesCents)}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
