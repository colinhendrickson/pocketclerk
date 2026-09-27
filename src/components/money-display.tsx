/**
 * MoneyDisplay: the display edge where integer cents become text (DESIGN.md
 * §4). It takes cents and passes them straight to `formatUSD`; no arithmetic
 * happens here. It sets no text color so it inherits from its container. Sizes
 * are px steps from the DESIGN.md §2 type scale, always weight 800 and tabular.
 */

import { formatUSD } from "@/lib/money";

/**
 * Sizes are named for their one use. `change` (up to 192px) is the largest text
 * in the app and is used only by ChangeCard on the cash-change screen; using it
 * anywhere else violates DESIGN.md.
 */
export type MoneySize = "change" | "total" | "running" | "stat" | "row";

export interface MoneyDisplayProps {
  /** Integer cents. Never a float, never a dollar amount. */
  cents: number;
  size?: MoneySize;
  /** Layout-only extras. Never a color or a font-size. */
  className?: string;
}

const SIZE_CLASS: Record<MoneySize, string> = {
  // Font size set inline by changeFontSize.
  change: "leading-none whitespace-nowrap",
  // Payment-screen total.
  total: "text-[64px] md:text-[104px] leading-none",
  // Order-builder running total.
  running: "text-[52px] md:text-[68px] leading-none",
  stat: "text-[34px] leading-tight",
  // List rows, table cells, menu prices.
  row: "text-[22px] leading-tight",
};

/** Maximum change-amount size, the top of the DESIGN.md 184–200px band. */
const CHANGE_MAX_PX = 192;
/** Approximate width of one character, in ems, with a margin. */
const CHANGE_EM_PER_CHAR = 0.6;

/**
 * Change-amount font size: 192px where it fits, otherwise sized by its own
 * length in container units (ChangeCard's body) so it is never clipped and
 * stays on one line.
 */
function changeFontSize(text: string): string {
  const cqw = 100 / (text.length * CHANGE_EM_PER_CHAR);
  return `min(${CHANGE_MAX_PX}px, ${cqw.toFixed(2)}cqw)`;
}

export function MoneyDisplay({
  cents,
  size = "row",
  className,
}: MoneyDisplayProps) {
  const text = formatUSD(cents);
  return (
    <span
      className={`tabular font-extrabold ${SIZE_CLASS[size]} ${className ?? ""}`}
      style={size === "change" ? { fontSize: changeFontSize(text) } : undefined}
    >
      {text}
    </span>
  );
}
