"use client";

import { Coffee, ClipboardList, LogOut, Package, Clock } from "lucide-react";
import { useRouter } from "next/navigation";

import { BigButton } from "@/components";

/**
 * The five dashboard actions from the client's specification.
 *
 * Exactly one is `primary`, and it is the one a student does dozens of times a
 * shift. The rest are deliberately quieter tiles: the screen should answer
 * "what do I do next?" before it offers anything else.
 *
 * A client component because BigButton takes a callback rather than an href.
 * The data above it is still fetched on the server and passed down.
 */
export function DashboardActions() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4">
      <BigButton
        variant="primary"
        icon={Coffee}
        onClick={() => router.push("/shift/order")}
        className="min-h-[160px] text-[34px]"
      >
        Start classroom order
      </BigButton>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <BigButton
          layout="tile"
          icon={ClipboardList}
          onClick={() => router.push("/shift/orders")}
        >
          Today&rsquo;s orders
        </BigButton>
        <BigButton layout="tile" icon={Package} disabled>
          Inventory
        </BigButton>
        <BigButton layout="tile" icon={Clock} disabled>
          My shift
        </BigButton>
        <BigButton
          layout="tile"
          variant="clockOut"
          icon={LogOut}
          onClick={() => router.push("/shift/clock-out")}
        >
          Clock out
        </BigButton>
      </div>
    </div>
  );
}
