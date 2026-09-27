/**
 * MoneyDisplay — the only place integer cents become visible text.
 *
 * Implements the MoneyDisplay row of the DESIGN.md §4 map: plain text meant to
 * sit inside a `stat-value`, a `card`, or a `table td`, carrying no color of
 * its own so it inherits `base-content` or `neutral-content` from whatever it is
 * dropped into. That inheritance is why this component sets no text color.
 *
 * Every size here is a literal step off the DESIGN.md §2 type scale rather than
 * a Tailwind `text-*` keyword, because the scale is specified in px and the
 * keywords do not line up with it. All variants are weight 800 and carry the
 * `tabular` utility from `globals.css`, which is the "money is always
 * tabular-nums" rule from the top of DESIGN.md.
 *
 * Values arrive as integer cents and are handed straight to `formatUSD`. No
 * arithmetic happens in this file — subtracting a total from a payment is
 * `changeCents` in `src/lib/money.ts`, not a component's job.
 */

import { formatUSD } from "@/lib/money";

/**
 * Sizes are named for their one job so a reviewer can spot a misuse by reading
 * the JSX.
 *
 * `change` tops out at 192px, the top of the 184–200 band, and DESIGN.md states
 * this size exists in exactly one place in the app: the change amount on the
 * cash-change screen, inside ChangeCard. It is the largest text in the product and the thing
 * a student reads across the counter. If `size="change"` ever appears outside
 * ChangeCard, that is a design-system violation, not a judgment call.
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
  // 184–200 / 800 — cash-change screen only. See the note on MoneySize above,
  // and on changeFontSize below for how it shrinks to fit.
  change: "leading-none whitespace-nowrap",
  // 104 / 800 — total on the payment screen; 64 on a phone, under the change.
  total: "text-[64px] md:text-[104px] leading-none",
  // 64–72 / 800 — running total in the order builder; 52 in the phone sheet.
  running: "text-[52px] md:text-[68px] leading-none",
  // 34 / 800 — stat values and other mid-weight figures.
  stat: "text-[34px] leading-tight",
  // 22–24 / 800 — list rows, table cells, menu prices.
  row: "text-[22px] leading-tight",
};

/** The top of the 184–200 band. The change amount is never larger than this. */
const CHANGE_MAX_PX = 192;
/** Width of one character of the change figure, in ems, with a margin. */
const CHANGE_EM_PER_CHAR = 0.6;

/**
 * The change amount's font size: the full 192px wherever it fits, and
 * otherwise exactly as large as its container allows.
 *
 * A fixed size cut the figure off on a phone, and this number is the one that
 * must never be cut off. Sizing it by its own length, in container units,
 * keeps "$4.00" as large as the card is wide at every screen size, and keeps a
 * long entry like "$9,998.99" on one line. The container is ChangeCard's body.
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
