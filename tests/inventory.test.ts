import { describe, expect, it } from "vitest";

import {
  CHECKLIST,
  MAX_COUNT,
  addedCount,
  allCounted,
  clampCount,
  isValidCount,
  isChecklistKey,
  restockNeeded,
  usedCount,
  type CountRow,
} from "@/lib/inventory-rules";

const row = (over: Partial<CountRow> = {}): CountRow => ({
  itemId: "id",
  name: "Coffee cups",
  unit: "cups",
  parLevel: 50,
  starting: 50,
  remaining: null,
  restocked: false,
  ...over,
});

describe("usedCount", () => {
  it("is unknown until the item is counted", () => {
    expect(usedCount(row())).toBeNull();
  });

  it("is the difference between the start and what is left", () => {
    expect(usedCount(row({ starting: 50, remaining: 38 }))).toBe(12);
  });

  it("is zero when nothing was used", () => {
    expect(usedCount(row({ starting: 50, remaining: 50 }))).toBe(0);
  });

  it("is zero, not negative, when stock was added since the last count", () => {
    expect(usedCount(row({ starting: 20, remaining: 30 }))).toBe(0);
  });
});

describe("addedCount", () => {
  it("is unknown until the item is counted", () => {
    expect(addedCount(row())).toBeNull();
  });

  it("is zero when the count is at or below the start", () => {
    expect(addedCount(row({ starting: 50, remaining: 38 }))).toBe(0);
    expect(addedCount(row({ starting: 50, remaining: 50 }))).toBe(0);
  });

  it("is how far the count is above the start, e.g. a teacher refilled cups", () => {
    expect(addedCount(row({ starting: 20, remaining: 30 }))).toBe(10);
  });
});

describe("counts", () => {
  it("accepts any whole number from zero up to the maximum, including above the start", () => {
    expect(isValidCount(0)).toBe(true);
    expect(isValidCount(75)).toBe(true);
    expect(isValidCount(MAX_COUNT)).toBe(true);
  });

  it("refuses negatives, fractions, non-numbers and absurd counts", () => {
    expect(isValidCount(-1)).toBe(false);
    expect(isValidCount(2.5)).toBe(false);
    expect(isValidCount("5")).toBe(false);
    expect(isValidCount(Number.NaN)).toBe(false);
    expect(isValidCount(MAX_COUNT + 1)).toBe(false);
  });

  it("clamps the stepper at zero and the maximum, not at the start", () => {
    expect(clampCount(-1)).toBe(0);
    expect(clampCount(61)).toBe(61);
    expect(clampCount(MAX_COUNT + 1)).toBe(MAX_COUNT);
  });
});

describe("restockNeeded", () => {
  it("is nothing until the item is counted", () => {
    expect(restockNeeded(row())).toBe(0);
  });

  it("is the gap back up to par", () => {
    expect(restockNeeded(row({ parLevel: 50, remaining: 38 }))).toBe(12);
  });

  it("is zero for a full item", () => {
    expect(restockNeeded(row({ parLevel: 50, remaining: 50 }))).toBe(0);
  });

  it("never goes negative when a cart is over-stocked", () => {
    // Par can be lowered by an admin after a cart was already filled.
    expect(restockNeeded(row({ parLevel: 40, starting: 60, remaining: 55 }))).toBe(0);
  });

  it("measures from the count, not the start, when stock was added mid-week", () => {
    expect(restockNeeded(row({ parLevel: 50, starting: 20, remaining: 30 }))).toBe(20);
    expect(restockNeeded(row({ parLevel: 50, starting: 20, remaining: 60 }))).toBe(0);
  });
});

describe("allCounted", () => {
  it("is false while any item is uncounted", () => {
    expect(allCounted([row({ remaining: 10 }), row()])).toBe(false);
  });

  it("is true once every item has a count", () => {
    expect(allCounted([row({ remaining: 10 }), row({ remaining: 0 })])).toBe(true);
  });

  it("is false for an empty sheet, so nothing is gated on a list of nothing", () => {
    expect(allCounted([])).toBe(false);
  });
});

describe("checklist", () => {
  it("covers the tasks in the client's specification", () => {
    expect(CHECKLIST.map((e) => e.key)).toEqual([
      "inventory",
      "restocked",
      "cleaned",
      "money",
      "orders",
      "tidy",
    ]);
  });

  it("accepts only its own keys, since they arrive from the browser", () => {
    expect(isChecklistKey("cleaned")).toBe(true);
    expect(isChecklistKey("anything-else")).toBe(false);
    expect(isChecklistKey(7)).toBe(false);
  });
});
