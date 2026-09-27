"use client";

/**
 * BigButton: the student task-screen button (DESIGN.md §4). At most one
 * `primary` per screen. Minimum height is 60px; tiles use `rounded-box` so a
 * large theme `--radius-field` cannot turn them into capsules.
 *
 * The `icon` prop is a component reference, so it must be passed from a client
 * component; server-rendered screens should wrap their button group in one.
 */

import type { LucideIcon } from "lucide-react";

export type BigButtonVariant = "primary" | "secondary" | "clockOut";
export type BigButtonLayout = "list" | "tile";

export interface BigButtonProps {
  /** Sentence-case label. */
  children: React.ReactNode;
  /** Shown left of the label, or above it in tile layout. */
  icon?: LucideIcon;
  /** Only one `primary` per screen. */
  variant?: BigButtonVariant;
  /** `list` is a full-width row; `tile` is the 110px square for the 2x2 grid. */
  layout?: BigButtonLayout;
  onClick?: () => void;
  disabled?: boolean;
  /** Layout-only extras (grid span, width). Never color or type-size classes. */
  className?: string;
}

const VARIANT_CLASS: Record<BigButtonVariant, string> = {
  primary: "btn btn-primary",
  secondary: "btn bg-base-100 border-base-300",
  clockOut: "btn btn-outline btn-secondary",
};

// The primary label drops to 26px below lg so it fits narrow columns.
const LABEL_CLASS: Record<BigButtonVariant, string> = {
  primary: "text-[26px] lg:text-[34px]",
  secondary: "text-[22px]",
  clockOut: "text-[22px]",
};

const ICON_CLASS: Record<BigButtonVariant, string> = {
  primary: "size-[40px] lg:size-[56px]",
  secondary: "size-[34px]",
  clockOut: "size-[34px]",
};

export function BigButton({
  children,
  icon: Icon,
  variant = "secondary",
  layout = "list",
  onClick,
  disabled,
  className,
}: BigButtonProps) {
  // Below md a tile renders as a full-width row (DESIGN.md §3).
  const layoutClass =
    layout === "tile"
      ? "justify-start gap-4 min-h-[64px] md:flex-col md:justify-center md:gap-2 md:min-h-[110px] rounded-box md:text-center"
      : "justify-start gap-4 min-h-[60px]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${VARIANT_CLASS[variant]} ${layoutClass} h-auto px-6 py-4 font-extrabold ${LABEL_CLASS[variant]} ${className ?? ""}`}
    >
      {Icon ? <Icon aria-hidden="true" className={`shrink-0 ${ICON_CLASS[variant]}`} /> : null}
      <span>{children}</span>
    </button>
  );
}
