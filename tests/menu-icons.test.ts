import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MENU_ICONS, isMenuIconKey } from "@/lib/menu-icons";
import { parseMenuIcon } from "@/lib/validate";

/**
 * Pictures beside menu names, for students who cannot read the words yet.
 * Staff choose from a fixed set, so the cart never shows something unexpected.
 */

const ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

describe("the picture set", () => {
  it("has a unique key and a label for every picture", () => {
    const keys = MENU_ICONS.map((icon) => icon.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const icon of MENU_ICONS) expect(icon.label.length).toBeGreaterThan(2);
  });

  it("knows its own keys and nothing else", () => {
    expect(isMenuIconKey("mug")).toBe(true);
    expect(isMenuIconKey("no-dairy")).toBe(true);
    for (const junk of ["", "Mug", "rocket", null, 3, undefined]) {
      expect(isMenuIconKey(junk), String(junk)).toBe(false);
    }
  });

  it("is the same list the database allows", () => {
    // The CHECK constraint is hand-written in the migration; a key added here
    // and not there would save in the browser and fail in the database.
    const migration = readFileSync("drizzle/0012_menu_icons.sql", "utf8");
    for (const { key } of MENU_ICONS) expect(migration).toContain(`'${key}'`);
  });
});

describe("parseMenuIcon", () => {
  it("accepts a picture for an item or an add-on", () => {
    expect(parseMenuIcon({ kind: "item", id: ID, icon: "mug" })).toEqual({ kind: "item", id: ID, icon: "mug" });
    expect(parseMenuIcon({ kind: "addon", id: ID, icon: "sugar" })).toEqual({ kind: "addon", id: ID, icon: "sugar" });
  });

  it("accepts no picture", () => {
    expect(parseMenuIcon({ kind: "item", id: ID, icon: null })).toEqual({ kind: "item", id: ID, icon: null });
  });

  it("refuses anything outside the set", () => {
    expect(parseMenuIcon({ kind: "item", id: ID, icon: "rocket" })).toBeNull();
    expect(parseMenuIcon({ kind: "item", id: ID, icon: "<svg onload=alert(1)>" })).toBeNull();
    expect(parseMenuIcon({ kind: "item", id: ID })).toBeNull();
    expect(parseMenuIcon({ kind: "drink", id: ID, icon: "mug" })).toBeNull();
    expect(parseMenuIcon({ kind: "item", id: "nope", icon: "mug" })).toBeNull();
    expect(parseMenuIcon(null)).toBeNull();
  });
});
