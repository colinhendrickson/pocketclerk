/**
 * ShiftStats: a daisyUI `stats` row (DESIGN.md §4). Student screens are capped
 * at three stats so the row stays horizontal on a phone (§3); `audience="admin"`
 * lifts the cap. Values arrive as integer cents or hundredths of an hour and
 * are only formatted here, never computed.
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
  /** Layout-only extras. Never a color. */
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
