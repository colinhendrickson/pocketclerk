"use client";

/**
 * Keypad and BillButtons: cash-received entry on the cash-change screen
 * (DESIGN.md §4). Both are stateless and report taps upward; the screen owns
 * the amount in cents, and all money math stays in `src/lib/money.ts`.
 * Keys carry explicit aria-labels so screen readers announce actions, not glyphs.
 */

import { Delete } from "lucide-react";
import { formatUSD } from "@/lib/money";

const DIGIT_ROWS: readonly (readonly string[])[] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
];

// No type size in the base: two size classes on one element resolve by
// stylesheet order, not class order.
const KEY_BASE = "btn bg-base-100 border-base-300 min-h-[60px] h-[72px] font-extrabold tabular";
const KEY_CLASS = `${KEY_BASE} text-[34px]`;

export interface KeypadProps {
  /** Called with a single character, "0"–"9". */
  onDigit: (digit: string) => void;
  onClear?: () => void;
  onBackspace?: () => void;
  disabled?: boolean;
}

export function Keypad({
  onDigit,
  onClear,
  onBackspace,
  disabled,
}: KeypadProps) {
  return (
    <div
      role="group"
      aria-label="Number keypad"
      className="grid grid-cols-3 gap-3"
    >
      {DIGIT_ROWS.flat().map((digit) => (
        <button
          key={digit}
          type="button"
          aria-label={`Number ${digit}`}
          onClick={() => onDigit(digit)}
          disabled={disabled}
          className={KEY_CLASS}
        >
          {digit}
        </button>
      ))}

      <button
        type="button"
        aria-label="Clear the amount"
        onClick={onClear}
        disabled={disabled || !onClear}
        className={`${KEY_BASE} text-[22px]`}
      >
        Clear
      </button>

      <button
        type="button"
        aria-label="Number 0"
        onClick={() => onDigit("0")}
        disabled={disabled}
        className={KEY_CLASS}
      >
        0
      </button>

      <button
        type="button"
        aria-label="Delete last digit"
        onClick={onBackspace}
        disabled={disabled || !onBackspace}
        className={KEY_CLASS}
      >
        <Delete size={34} aria-hidden="true" />
      </button>
    </div>
  );
}

/** Default bills in integer cents, smallest first. */
const DEFAULT_BILLS: readonly number[] = [100, 500, 1000, 2000];

export interface BillButtonsProps {
  onSelect: (cents: number) => void;
  /** Bill values in integer cents. Defaults to $1 / $5 / $10 / $20. */
  bills?: readonly number[];
  /** The chosen bill in cents, rendered solid instead of outlined. */
  selectedCents?: number | null;
  disabled?: boolean;
}

export function BillButtons({
  onSelect,
  bills = DEFAULT_BILLS,
  selectedCents = null,
  disabled,
}: BillButtonsProps) {
  return (
    <div role="group" aria-label="Bill amounts" className="@container">
      {/* Container query, not viewport: on a tablet this sits in a narrow column. */}
      <div className="grid grid-cols-2 gap-3 @min-[26rem]:grid-cols-4">
        {bills.map((cents) => {
          const selected = cents === selectedCents;
          return (
            <button
              key={cents}
              type="button"
              aria-pressed={selected}
              aria-label={`${formatUSD(cents)} bill`}
              onClick={() => onSelect(cents)}
              disabled={disabled}
              className={`btn ${
                selected ? "btn-secondary" : "btn-outline btn-secondary"
              } min-h-[60px] h-[72px] px-1 text-[22px] font-extrabold tabular`}
            >
              {formatUSD(cents)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
