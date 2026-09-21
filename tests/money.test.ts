import { describe, expect, it } from "vitest";

import {
  InsufficientPayment,
  changeCents,
  denominationBreakdown,
  denominationHint,
  formatHours,
  formatUSD,
  hoursHundredthsBetween,
  orderTotalCents,
  rewardTickets,
} from "@/lib/money";

/**
 * Coverage here is deliberately disproportionate. This is the one module where a
 * bug teaches a student the wrong answer in front of a customer, so the change
 * calculation is tested exhaustively while thinner modules rely on the end-to-end
 * flow instead.
 */

describe("orderTotalCents", () => {
  it("is zero for an empty order", () => {
    expect(orderTotalCents([])).toBe(0);
  });

  it("multiplies unit price by quantity", () => {
    expect(orderTotalCents([{ unitPriceCents: 100, qty: 3 }])).toBe(300);
  });

  it("sums multiple lines", () => {
    expect(
      orderTotalCents([
        { unitPriceCents: 100, qty: 2 },
        { unitPriceCents: 150, qty: 1 },
      ]),
    ).toBe(350);
  });

  it("charges add-ons once per unit, not once per line", () => {
    expect(
      orderTotalCents([{ unitPriceCents: 100, qty: 2, addonPriceCents: [25] }]),
    ).toBe(250);
  });

  it("leaves the total untouched for free add-ons", () => {
    expect(
      orderTotalCents([{ unitPriceCents: 100, qty: 1, addonPriceCents: [0, 0] }]),
    ).toBe(100);
  });

  it("does not drift on the classic floating point case", () => {
    // 0.1 + 0.2 !== 0.3 in floats. In cents it is exact, every time.
    const lines = Array.from({ length: 3 }, () => ({ unitPriceCents: 10, qty: 1 }));
    expect(orderTotalCents(lines)).toBe(30);
  });
});

describe("changeCents", () => {
  it("returns zero for exact payment", () => {
    expect(changeCents(200, 200)).toBe(0);
  });

  it("returns the difference when overpaid", () => {
    expect(changeCents(200, 500)).toBe(300);
  });

  it("handles a twenty for a small order", () => {
    expect(changeCents(175, 2000)).toBe(1825);
  });

  it("throws when the payment does not cover the total", () => {
    expect(() => changeCents(200, 199)).toThrow(InsufficientPayment);
  });

  it("carries the amounts on the thrown error for the UI to report", () => {
    try {
      changeCents(200, 150);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(InsufficientPayment);
      const e = error as InsufficientPayment;
      expect(e.totalCents).toBe(200);
      expect(e.receivedCents).toBe(150);
    }
  });

  it("treats a free order as payable with nothing", () => {
    expect(changeCents(0, 0)).toBe(0);
  });
});

describe("denominationBreakdown", () => {
  it("breaks three dollars into three ones", () => {
    expect(denominationBreakdown(300)).toEqual([
      { valueCents: 100, count: 3, label: "one-dollar bill", labelPlural: "one-dollar bills" },
    ]);
  });

  it("prefers larger denominations first", () => {
    const parts = denominationBreakdown(1825);
    expect(parts.map((p) => [p.valueCents, p.count])).toEqual([
      [1000, 1],
      [500, 1],
      [100, 3],
      [25, 1],
    ]);
  });

  it("returns nothing for zero", () => {
    expect(denominationBreakdown(0)).toEqual([]);
  });

  it("reaches coins", () => {
    expect(denominationBreakdown(41).map((p) => [p.valueCents, p.count])).toEqual([
      [25, 1],
      [10, 1],
      [5, 1],
      [1, 1],
    ]);
  });

  it("rejects negative amounts", () => {
    expect(() => denominationBreakdown(-1)).toThrow(RangeError);
  });
});

describe("denominationHint", () => {
  it("pluralises correctly", () => {
    expect(denominationHint(300)).toBe("3 one-dollar bills");
    expect(denominationHint(100)).toBe("1 one-dollar bill");
  });

  it("joins several denominations readably", () => {
    expect(denominationHint(525)).toBe("1 five-dollar bill and 1 quarter");
  });

  it("uses commas before the final conjunction", () => {
    expect(denominationHint(1135)).toBe(
      "1 ten-dollar bill, 1 one-dollar bill, 1 quarter and 1 dime",
    );
  });

  it("says so when there is no change", () => {
    expect(denominationHint(0)).toBe("No change");
  });
});

describe("hoursHundredthsBetween", () => {
  const at = (h: number, m: number) => new Date(Date.UTC(2026, 8, 3, h, m));

  it("computes a whole shift", () => {
    expect(hoursHundredthsBetween(at(9, 0), at(12, 0))).toBe(300);
  });

  it("computes a quarter hour", () => {
    expect(hoursHundredthsBetween(at(9, 0), at(9, 15))).toBe(25);
  });

  it("rounds to the nearest hundredth", () => {
    expect(hoursHundredthsBetween(at(9, 0), at(9, 20))).toBe(33);
  });

  it("rejects a clock-out before clock-in", () => {
    expect(() => hoursHundredthsBetween(at(12, 0), at(9, 0))).toThrow(RangeError);
  });
});

describe("rewardTickets", () => {
  it("awards one ticket per whole hour", () => {
    expect(rewardTickets(300)).toBe(3);
  });

  it("floors partial hours rather than rounding", () => {
    expect(rewardTickets(399)).toBe(3);
    expect(rewardTickets(275)).toBe(2);
  });

  it("awards nothing for less than an hour", () => {
    expect(rewardTickets(99)).toBe(0);
  });

  it("rejects negative hours", () => {
    expect(() => rewardTickets(-1)).toThrow(RangeError);
  });
});

describe("formatUSD", () => {
  it("always shows two decimal places", () => {
    expect(formatUSD(0)).toBe("$0.00");
    expect(formatUSD(5)).toBe("$0.05");
    expect(formatUSD(100)).toBe("$1.00");
    expect(formatUSD(1825)).toBe("$18.25");
  });

  it("handles negatives for admin adjustments", () => {
    expect(formatUSD(-250)).toBe("-$2.50");
  });
});

describe("formatHours", () => {
  it("renders hundredths as decimal hours", () => {
    expect(formatHours(325)).toBe("3.25");
    expect(formatHours(300)).toBe("3.00");
  });
});
