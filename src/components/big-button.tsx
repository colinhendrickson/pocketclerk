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
 * primary, 22px/800 for everything else. Labels are sentence case; this file
 * never upper-cases them and `globals.css` pins `.btn { text-transform: none }`.
 *
 * This is a client entry point only because it owns an `onClick`. That also
 * means the `icon` prop — a `LucideIcon` component reference — has to be passed
 * from another client component; a server component cannot serialise a function
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
  /** Layout-only extras (grid span, width). Never colour or type-size classes. */
  className?: string;
}

const VARIANT_CLASS: Record<BigButtonVariant, string> = {
  primary: "btn btn-primary",
  secondary: "btn bg-base-100 border-base-300",
  clockOut: "btn btn-outline btn-secondary",
};

const LABEL_CLASS: Record<BigButtonVariant, string> = {
  primary: "text-[34px]",
  secondary: "text-[22px]",
  clockOut: "text-[22px]",
};

const ICON_PX: Record<BigButtonVariant, number> = {
  primary: 56,
  secondary: 34,
  clockOut: 34,
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
  const layoutClass =
    layout === "tile"
      ? "flex-col gap-2 min-h-[110px] rounded-box text-center"
      : "justify-start gap-4 min-h-[60px]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${VARIANT_CLASS[variant]} ${layoutClass} h-auto px-6 py-4 font-extrabold ${LABEL_CLASS[variant]} ${className ?? ""}`}
    >
      {Icon ? <Icon size={ICON_PX[variant]} aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}
