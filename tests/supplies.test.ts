import { describe, expect, it } from "vitest";

import { parseNewSupply, parseSupplyEdit } from "@/lib/validate";

/** Supplies staff add on the Inventory page: what the cart carries, and how many when full. */

const ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

describe("parseNewSupply", () => {
  it("accepts a name, a unit and how many a full cart holds", () => {
    expect(parseNewSupply({ name: " Coffee cups ", unit: "cups", parLevel: 50 })).toEqual({
      name: "Coffee cups",
      unit: "cups",
      parLevel: 50,
    });
  });

  it("counts in items when no unit is given", () => {
    expect(parseNewSupply({ name: "Napkins", unit: "", parLevel: 100 })?.unit).toBe("items");
    expect(parseNewSupply({ name: "Napkins", parLevel: 100 })?.unit).toBe("items");
  });

  it("refuses a missing name, a bad amount, or an overlong unit", () => {
    expect(parseNewSupply({ name: "", unit: "cups", parLevel: 50 })).toBeNull();
    expect(parseNewSupply({ name: "Cups", unit: "cups", parLevel: 0 })).toBeNull();
    expect(parseNewSupply({ name: "Cups", unit: "cups", parLevel: 2.5 })).toBeNull();
    expect(parseNewSupply({ name: "Cups", unit: "cups", parLevel: "50" })).toBeNull();
    expect(parseNewSupply({ name: "Cups", unit: "cups", parLevel: 100_000 })).toBeNull();
    expect(parseNewSupply({ name: "Cups", unit: "x".repeat(21), parLevel: 50 })).toBeNull();
    expect(parseNewSupply(null)).toBeNull();
  });
});

describe("parseSupplyEdit", () => {
  it("needs a real id as well", () => {
    expect(parseSupplyEdit({ id: ID, name: "Lids", unit: "lids", parLevel: 40 })).toEqual({
      id: ID,
      name: "Lids",
      unit: "lids",
      parLevel: 40,
    });
    expect(parseSupplyEdit({ id: "nope", name: "Lids", unit: "lids", parLevel: 40 })).toBeNull();
  });
});
