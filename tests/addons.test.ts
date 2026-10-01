import { describe, expect, it } from "vitest";

import { addOne, countRepeats, removeOne } from "@/lib/addons";

/** Two sugars is the sugar id twice; these keep that list honest. */
describe("add-on counts", () => {
  it("counts repeats in the order first seen", () => {
    expect(countRepeats(["sugar", "cream", "sugar"])).toEqual([
      { id: "sugar", count: 2 },
      { id: "cream", count: 1 },
    ]);
    expect(countRepeats([])).toEqual([]);
  });

  it("adds one, up to the limit", () => {
    expect(addOne(["sugar"], "sugar", 10)).toEqual(["sugar", "sugar"]);
    expect(addOne(["a", "b"], "c", 2)).toEqual(["a", "b"]);
  });

  it("takes away one of that kind only, and ignores one that is not there", () => {
    expect(removeOne(["sugar", "cream", "sugar"], "sugar")).toEqual(["sugar", "cream"]);
    expect(removeOne(["cream"], "sugar")).toEqual(["cream"]);
  });
});
