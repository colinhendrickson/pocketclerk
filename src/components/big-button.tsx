"use client";

/**
 * BigButton — the only button students tap on a task screen.
 *
 * Implements the BigButton row of the DESIGN.md §4 primitive map: daisyUI `btn`
 * with `btn-primary` reserved for the single primary action per screen, plain
 * `btn bg-base-100 border-base-300` for secondary actions, and
 * `btn btn-outline btn-secondary` for Clock out. Height floor is the 60px touch
 * target from the global rules; tiles go to 110px so that a theme with a large
 * `--radius-field` cannot render them as capsules — tiles therefore take
 * `rounded-box` instead, which is exactly the "theme-driven" column of the map.
 *
 * Label sizes come from the type scale in DESIGN.md §2: 34px/800 for the
 * primary (26px below lg), 22px/800 for everything else. Labels are sentence
 * case; this file never upper-cases them and `globals.css` pins
 * `.btn { text-transform: none }`.
 *
 * This is a client entry point only because it owns an `onClick`. That also
 * means the `icon` prop — a `LucideIcon` component reference — has to be passed
 * from another client component; a server component cannot serialize a function
 * across the boundary. Screens that are otherwise server-rendered should wrap
 * their button group in a small client component.
 */

import type { LucideIcon } from "lucide-react";

export type BigButtonVariant = "primary" | "secondary" | "clockOut";
export type BigButtonLayout = "list" | "tile";

export interface BigButtonProps {
  /** Sentence-case label. Student-facing copy, never a sentence fragment in caps. */
  children: React.ReactNode;
  /** Optional Lucide glyph rendered to the left of the label (or above it in tile layout). */
  icon?: LucideIcon;
  /** Only one `primary` may exist per screen — that is the one-primary-action rule. */
  variant?: BigButtonVariant;
  /** `list` is the full-width row; `tile` is the 110px square used in the 2x2 secondary grid. */
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

// The primary label steps down to 26px below lg: at 34px, "Start classroom
// order" wrapped to three lines on a phone, and "Go to payment" to two in the
// tablet's 340px order column.
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
  // Below md a tile is a full-width 64px row with its icon on the left, per
  // DESIGN.md §3: a 2x2 grid of tall tiles does not fit a phone.
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
