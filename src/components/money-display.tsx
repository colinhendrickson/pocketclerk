/**
 * MoneyDisplay — the only place integer cents become visible text.
 *
 * Implements the MoneyDisplay row of the DESIGN.md §4 map: plain text meant to
 * sit inside a `stat-value`, a `card`, or a `table td`, carrying no colour of
 * its own so it inherits `base-content` or `neutral-content` from whatever it is
 * dropped into. That inheritance is why this component sets no text colour.
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
 * `change` is 192px, the top of the 184–200 band, and DESIGN.md states this size
 * exists in exactly one place in the app: the change amount on the cash-change
 * screen, inside ChangeCard. It is the largest text in the product and the thing
 * a student reads across the counter. If `size="change"` ever appears outside
 * ChangeCard, that is a design-system violation, not a judgement call.
 */
export type MoneySize = "change" | "total" | "running" | "stat" | "row";

export interface MoneyDisplayProps {
  /** Integer cents. Never a float, never a dollar amount. */
  cents: number;
  size?: MoneySize;
  /** Layout-only extras. Never a colour or a font-size. */
  className?: string;
}

const SIZE_CLASS: Record<MoneySize, string> = {
  // 184–200 / 800 — cash-change screen only. See the note on MoneySize above.
  change: "text-[192px] leading-none",
  // 104 / 800 — total on the payment screen.
  total: "text-[104px] leading-none",
  // 64–72 / 800 — running total in the order builder.
  running: "text-[68px] leading-none",
  // 34 / 800 — stat values and other mid-weight figures.
  stat: "text-[34px] leading-tight",
  // 22–24 / 800 — list rows, table cells, menu prices.
  row: "text-[22px] leading-tight",
};

export function MoneyDisplay({
  cents,
  size = "row",
  className,
}: MoneyDisplayProps) {
  return (
    <span
      className={`tabular font-extrabold ${SIZE_CLASS[size]} ${className ?? ""}`}
    >
      {formatUSD(cents)}
    </span>
  );
}
