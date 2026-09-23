/**
 * ShiftStats — the three numbers a student sees about their own shift.
 *
 * Implements the ShiftStats row of the DESIGN.md §4 map: daisyUI `stats` with
 * `stat` / `stat-title` / `stat-value`, on `bg-base-100 border-base-300` so the
 * theme owns the surface, `tabular` on every value, and a hard ceiling of three
 * stats on student screens. That ceiling is enforced here rather than left to
 * the caller: §3 keeps the stats row horizontal at every breakpoint including
 * phone portrait, and a fourth stat is what forces it to wrap or scroll.
 * `audience="admin"` lifts the limit for the denser admin views.
 *
 * Values come in as integer cents or integer hundredths of an hour and are
 * formatted through `src/lib/money.ts`. A stat is a display of a number the
 * database already computed; nothing in this file divides, sums, or rounds.
 *
 * Value type sizes track §2: 34px from md up, 22px in the phone row below it,
 * which is what keeps three stats on one row at phone width.
 */

import { formatHours, formatUSD } from "@/lib/money";

export type ShiftStat =
  | { title: string; valueCents: number; desc?: string }
  | { title: string; hoursHundredths: number; desc?: string }
  | { title: string; value: string; tabular?: boolean; desc?: string };

export interface ShiftStatsProps {
  items: readonly ShiftStat[];
  /** Student screens are capped at three stats; admin screens are not. */
  audience?: "student" | "admin";
  /** Pins values to the 22px phone step at every width. */
  compact?: boolean;
  /** Layout-only extras. Never a colour. */
  className?: string;
}

function renderValue(item: ShiftStat): { text: string; tabular: boolean } {
  if ("valueCents" in item) {
    return { text: formatUSD(item.valueCents), tabular: true };
  }
  if ("hoursHundredths" in item) {
    return { text: formatHours(item.hoursHundredths), tabular: true };
  }
  return { text: item.value, tabular: item.tabular ?? false };
}

export function ShiftStats({
  items,
  audience = "student",
  compact = false,
  className,
}: ShiftStatsProps) {
  const shown = audience === "student" ? items.slice(0, 3) : items;

  return (
    <div
      className={`stats w-full bg-base-100 border border-base-300 md:w-auto ${className ?? ""}`}
    >
      {shown.map((item) => {
        const { text, tabular } = renderValue(item);
        return (
          <div key={item.title} className="stat px-3 py-3 md:px-6 md:py-4">
            <div className="stat-title text-[15px] font-bold md:text-[18px]">
              {item.title}
            </div>
            <div
              className={`stat-value font-extrabold ${
                compact ? "text-[22px]" : "text-[22px] md:text-[34px]"
              } ${tabular ? "tabular" : ""}`}
            >
              {text}
            </div>
            {item.desc ? (
              <div className="stat-desc text-[15px] font-bold">{item.desc}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
