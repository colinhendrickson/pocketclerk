"use client";

import { useEffect, useState } from "react";

import { cartFormatter } from "@/lib/time";
import { ShiftStats } from "@/components";
import { branding } from "@/lib/branding";
import { formatHours, rewardTickets } from "@/lib/money";

export interface LiveHoursProps {
  /** Clock-in instant from the database, serialised across the client boundary. */
  clockInIso: string;
}

/**
 * Hours ticking up during a shift.
 *
 * The clock-in instant is authoritative and comes from the database; only the
 * *elapsed* figure is computed in the browser, so a tablet with a wrong clock
 * can make this ticker look odd but can never inflate the hours that get paid.
 * Clock-out recomputes everything on the server from the two stored timestamps.
 *
 * Three stats is the student-screen ceiling from DESIGN.md, which is why the
 * order count and running sales live on the orders screen instead of here.
 */
export function LiveHours({ clockInIso }: LiveHoursProps) {
  const [elapsed, setElapsed] = useState(() => hundredthsSince(clockInIso));

  useEffect(() => {
    // Half a minute is finer than the display resolution and costs nothing.
    const id = setInterval(() => setElapsed(hundredthsSince(clockInIso)), 30_000);
    return () => clearInterval(id);
  }, [clockInIso]);

  const clockInLabel = cartFormatter({
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(clockInIso));

  return (
    <ShiftStats
      items={[
        { title: "Clocked in", value: clockInLabel },
        { title: "Hours", value: formatHours(elapsed) },
        { title: branding.rewardName, value: String(rewardTickets(elapsed)) },
      ]}
    />
  );
}

function hundredthsSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return ms > 0 ? Math.round(ms / 36_000) : 0;
}
