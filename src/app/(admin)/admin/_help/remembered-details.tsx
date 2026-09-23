"use client";

import { useEffect, useState } from "react";

export interface RememberedDetailsProps {
  /** localStorage key; the choice is remembered per device, per page. */
  storageKey: string;
  summary: React.ReactNode;
  className?: string;
  summaryClassName?: string;
  children: React.ReactNode;
}

/**
 * A native `<details>` that remembers whether it was left open.
 *
 * Native, because it is already a disclosure widget to every screen reader
 * and keyboard with no ARIA to get wrong. Open by default: someone arriving
 * cold should see the help, and someone who knows the page can close it once.
 * The choice lives on the device, not the account, since it is about the
 * screen in front of them.
 */
export function RememberedDetails({
  storageKey,
  summary,
  className,
  summaryClassName,
  children,
}: RememberedDetailsProps) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (window.localStorage.getItem(storageKey) === "closed") setOpen(false);
  }, [storageKey]);

  return (
    <details
      open={open}
      onToggle={(event) => {
        const next = event.currentTarget.open;
        setOpen(next);
        window.localStorage.setItem(storageKey, next ? "open" : "closed");
      }}
      className={className}
    >
      <summary className={summaryClassName}>{summary}</summary>
      {children}
    </details>
  );
}
