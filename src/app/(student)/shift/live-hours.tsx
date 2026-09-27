"use client";

import { useEffect, useState } from "react";

import { cartFormatter } from "@/lib/time";
import { ShiftStats } from "@/components";
import { branding } from "@/lib/branding";
import { formatHours, rewardTickets } from "@/lib/money";

export interface LiveHoursProps {
  /** Clock-in instant from the database, serialized across the client boundary. */
  clockInIso: string;
}

/**
 * Hours ticking up during a shift. Display only: elapsed time uses the device
 * clock, but credited hours are recomputed on the server at clock-out from
 * stored timestamps.
 */
export function LiveHours({ clockInIso }: LiveHoursProps) {
  const [elapsed, setElapsed] = useState(() => hundredthsSince(clockInIso));

  useEffect(() => {
    // Finer than the display resolution (hundredths of an hour).
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
