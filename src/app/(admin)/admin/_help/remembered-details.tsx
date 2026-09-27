"use client";

import { useEffect, useState } from "react";

export interface RememberedDetailsProps {
  /** localStorage key (per device, per page). */
  storageKey: string;
  summary: React.ReactNode;
  className?: string;
  summaryClassName?: string;
  children: React.ReactNode;
}

/**
 * A native `<details>` (accessible without custom ARIA) that remembers its
 * open state in localStorage. Open by default.
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
