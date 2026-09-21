/**
 * Every money value in this application is an integer number of cents.
 *
 * Binary floating point cannot represent a tenth exactly, so `0.1 + 0.2` is not
 * `0.3`. Totals built from dollar floats drift, and a cart that teaches a student
 * to hand back the wrong change is the one unforgivable bug in this codebase.
 * Cents in, cents through, formatted only at the display edge.
 *
 * Nothing here imports the database or React. These are pure functions so they
 * can be tested exhaustively with no mocks, which is exactly what
 * `tests/money.test.ts` does.
 */

/** Thrown when a cash payment does not cover the amount owed. */
export class InsufficientPayment extends Error {
  constructor(
    readonly totalCents: number,
    readonly receivedCents: number,
  ) {
    super(`Received ${receivedCents} cents for a total of ${totalCents} cents`);
    this.name = "InsufficientPayment";
  }
}

export interface PricedLine {
  /** Price of one unit at the moment of sale, in cents. */
  unitPriceCents: number;
  qty: number;
  /** Per-unit extras. A free add-on is 0 and must not move the total. */
  addonPriceCents?: number[];
}

/**
 * Total for a set of order lines. Add-ons are per unit: two coffees each with a
 * 25 cent shot are charged for two shots.
 */
export function orderTotalCents(lines: readonly PricedLine[]): number {
  return lines.reduce((sum, line) => {
    const addons = (line.addonPriceCents ?? []).reduce((a, b) => a + b, 0);
    return sum + (line.unitPriceCents + addons) * line.qty;
  }, 0);
}

/**
 * Change owed on a cash sale.
 *
 * Throws rather than returning a negative number. Underpayment is a state the
 * UI must refuse to advance from, not a value to carry forward and format.
 */
export function changeCents(totalCents: number, receivedCents: number): number {
  if (receivedCents < totalCents) {
    throw new InsufficientPayment(totalCents, receivedCents);
  }
  return receivedCents - totalCents;
}

export interface Denomination {
  /** Value of one unit, in cents. */
  valueCents: number;
  count: number;
  /** Singular label, e.g. "one-dollar bill". */
  label: string;
  /** Plural label, e.g. "one-dollar bills". */
  labelPlural: string;
}

const US_DENOMINATIONS: ReadonlyArray<Omit<Denomination, "count">> = [
  { valueCents: 2000, label: "twenty-dollar bill", labelPlural: "twenty-dollar bills" },
  { valueCents: 1000, label: "ten-dollar bill", labelPlural: "ten-dollar bills" },
  { valueCents: 500, label: "five-dollar bill", labelPlural: "five-dollar bills" },
  { valueCents: 100, label: "one-dollar bill", labelPlural: "one-dollar bills" },
  { valueCents: 25, label: "quarter", labelPlural: "quarters" },
  { valueCents: 10, label: "dime", labelPlural: "dimes" },
  { valueCents: 5, label: "nickel", labelPlural: "nickels" },
  { valueCents: 1, label: "penny", labelPlural: "pennies" },
];

/**
 * Greedy breakdown of an amount into US bills and coins, largest first.
 *
 * This drives the hint under the change amount ("3 one-dollar bills"). The hint
 * is the teaching surface: it turns an abstract number into the physical act of
 * counting money out of the drawer.
 */
export function denominationBreakdown(cents: number): Denomination[] {
  if (cents < 0) throw new RangeError("Cannot break down a negative amount");
  let remaining = cents;
  const out: Denomination[] = [];
  for (const d of US_DENOMINATIONS) {
    const count = Math.floor(remaining / d.valueCents);
    if (count > 0) {
      out.push({ ...d, count });
      remaining -= count * d.valueCents;
    }
  }
  return out;
}

/** Plain-English rendering of the breakdown, e.g. "1 five-dollar bill and 2 quarters". */
export function denominationHint(cents: number): string {
  const parts = denominationBreakdown(cents).map(
    (d) => `${d.count} ${d.count === 1 ? d.label : d.labelPlural}`,
  );
  if (parts.length === 0) return "No change";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * Elapsed time as integer hundredths of an hour, the only representation stored.
 * Computed from database timestamps, never from the tablet's clock.
 */
export function hoursHundredthsBetween(clockIn: Date, clockOut: Date): number {
  const ms = clockOut.getTime() - clockIn.getTime();
  if (ms < 0) throw new RangeError("Clock-out precedes clock-in");
  return Math.round(ms / 36_000);
}

/**
 * Reward tickets earned for a shift: one per whole hour worked.
 *
 * Flooring is a product decision, not a rounding convenience. A partial hour
 * earns nothing, which is the rule the program uses, so it is written down here
 * rather than buried in a query.
 */
export function rewardTickets(hoursHundredths: number): number {
  if (hoursHundredths < 0) throw new RangeError("Negative hours");
  return Math.floor(hoursHundredths / 100);
}

/**
 * The display edge, and the only place cents become a string. Called from
 * components; never from server actions or anything in `src/db`.
 */
export function formatUSD(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Formats hundredths of an hour for display, e.g. 325 -> "3.25". */
export function formatHours(hoursHundredths: number): string {
  return (hoursHundredths / 100).toFixed(2);
}
