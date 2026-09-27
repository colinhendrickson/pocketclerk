"use client";

import { Coffee, ClipboardList, LogOut, Package, Clock } from "lucide-react";
import { useRouter } from "next/navigation";

import { BigButton } from "@/components";

/**
 * The five dashboard actions. Only the most frequent one (starting an order) is
 * `primary`. A client component because BigButton takes a callback, not an
 * href.
 */
export function DashboardActions() {
  const router = useRouter();

  return (
    // DESIGN.md §3: below md, actions stack full width with Clock out pinned
    // to the bottom.
    <div className="flex flex-1 flex-col gap-4">
      <BigButton
        variant="primary"
        icon={Coffee}
        onClick={() => router.push("/shift/order")}
        className="min-h-[88px] md:min-h-[160px]"
      >
        Start classroom order
      </BigButton>

      <div className="flex flex-1 flex-col gap-4 md:grid md:flex-none md:grid-cols-2">
        <BigButton
          layout="tile"
          icon={ClipboardList}
          onClick={() => router.push("/shift/orders")}
        >
          Today&rsquo;s orders
        </BigButton>
        <BigButton
          layout="tile"
          icon={Package}
          onClick={() => router.push("/shift/inventory")}
        >
          Inventory
        </BigButton>
        <BigButton layout="tile" icon={Clock} disabled>
          My shift
        </BigButton>
        <BigButton
          layout="tile"
          variant="clockOut"
          icon={LogOut}
          className="mt-auto md:mt-0"
          onClick={() => router.push("/shift/clock-out")}
        >
          Clock out
        </BigButton>
      </div>
    </div>
  );
}
