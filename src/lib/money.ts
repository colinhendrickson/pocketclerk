/**
 * Money math. Every value is an integer number of cents, formatted only at the
 * display edge; floats would drift. Pure functions with no database or React
 * imports. See docs/adr/0001-money-as-integer-cents.md.
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

/** Change owed on a cash sale. Throws on underpayment rather than returning a negative. */
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
 * Greedy breakdown of an amount into US bills and coins, largest first. Drives
 * the hint under the change amount.
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

/** Reward tickets for a shift: one per whole hour. Partial hours earn nothing (a product rule). */
export function rewardTickets(hoursHundredths: number): number {
  if (hoursHundredths < 0) throw new RangeError("Negative hours");
  return Math.floor(hoursHundredths / 100);
}

/** Formats cents as dollars. Call only from components, never server code. */
export function formatUSD(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Formats hundredths of an hour for display, e.g. 325 -> "3.25". */
export function formatHours(hoursHundredths: number): string {
  return (hoursHundredths / 100).toFixed(2);
}
