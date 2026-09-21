"use client";

/**
 * Keypad and BillButtons — how cash received gets entered.
 *
 * Implements the Keypad / BillButtons row of the DESIGN.md §4 map: `btn` grids
 * at `grid-cols-3` and `grid-cols-4`, 60px minimum keys, 34px numerals, and
 * bill buttons that are `btn-outline btn-secondary` until chosen and solid
 * `btn-secondary` once they are. Keys keep the theme's `--radius-field`, so they
 * are the only controls here that do not override radius.
 *
 * Both live in one file because they are one input surface: §3 puts the bill row
 * directly above the keypad on the cash-change screen, and the quick-buttons
 * exist so the common case (a customer hands over one bill) never requires
 * digit entry at all. Neither component holds state — the cash-change screen
 * owns the entered amount in cents and these report taps upward, which keeps all
 * money arithmetic in `src/lib/money.ts` and out of the input layer.
 *
 * Digit keys are labelled explicitly rather than relying on their glyph, and the
 * two edit keys get verb labels, because a student using VoiceOver should hear
 * "Delete last digit", not "backspace symbol".
 */

import { Delete } from "lucide-react";
import { formatUSD } from "@/lib/money";

const DIGIT_ROWS: readonly (readonly string[])[] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
];

const KEY_CLASS =
  "btn bg-base-100 border-base-300 min-h-[60px] h-[72px] text-[34px] font-extrabold tabular";

export interface KeypadProps {
  /** Called with a single character, "0"–"9". The screen appends it. */
  onDigit: (digit: string) => void;
  /** Clears the entry back to empty. */
  onClear?: () => void;
  /** Removes the last entered digit. */
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
        className={`${KEY_CLASS} text-[22px]`}
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

/** Bills a school cart realistically sees, in integer cents, smallest first. */
const DEFAULT_BILLS: readonly number[] = [100, 500, 1000, 2000];

export interface BillButtonsProps {
  /** Called with the tapped bill's value in cents. */
  onSelect: (cents: number) => void;
  /** Bill values in integer cents. Defaults to $1 / $5 / $10 / $20. */
  bills?: readonly number[];
  /** The currently chosen bill, in cents, rendered solid instead of outlined. */
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
    <div
      role="group"
      aria-label="Bill amounts"
      className="grid grid-cols-4 gap-3"
    >
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
            } min-h-[60px] h-[72px] text-[22px] font-extrabold tabular`}
          >
            {formatUSD(cents)}
          </button>
        );
      })}
    </div>
  );
}
