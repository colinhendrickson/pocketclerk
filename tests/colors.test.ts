import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BUTTON_TEXT_OPTIONS,
  DEFAULT_PRIMARY,
  MIN_CONTRAST,
  PRESET_COLORS,
  THEME_BACKGROUNDS,
  checkPrimary,
  contrastRatio,
  normalizeHex,
} from "@/lib/colors";

/**
 * The main colour is the one design decision staff can make, so it is the one
 * that has to be impossible to get unreadably wrong.
 */

describe("normalizeHex", () => {
  it("accepts what people paste, and stores one form", () => {
    expect(normalizeHex("#1D4ED8")).toBe("#1d4ed8");
    expect(normalizeHex("1d4ed8")).toBe("#1d4ed8");
    expect(normalizeHex(" #14d ")).toBe("#1144dd");
  });

  it("refuses anything that is not a colour", () => {
    for (const bad of ["blue", "#12345", "#1234567", "#gggggg", "", null, 123]) {
      expect(normalizeHex(bad), String(bad)).toBeNull();
    }
  });
});

describe("contrastRatio", () => {
  it("matches the WCAG reference values", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    // WebAIM's contrast checker gives 4.54:1 for #767676 on white.
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });
});

describe("checkPrimary", () => {
  it("passes the original teal and every ready-made colour", () => {
    expect(checkPrimary(DEFAULT_PRIMARY).ok).toBe(true);
    for (const preset of PRESET_COLORS) {
      const check = checkPrimary(preset.hex);
      expect(check.ok, preset.name).toBe(true);
      expect(check.onBackground, preset.name).toBeGreaterThanOrEqual(MIN_CONTRAST);
      expect(check.onButton, preset.name).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });

  it("refuses a light blue, and suggests a darker shade that passes", () => {
    const check = checkPrimary("#60a5fa");
    expect(check.ok).toBe(false);
    expect(check.suggestion).not.toBeNull();
    expect(checkPrimary(check.suggestion!).ok).toBe(true);
  });

  it("picks button text that reads on the colour", () => {
    expect(checkPrimary("#1e3a8a").buttonText).toBe("#ffffff");
    expect(BUTTON_TEXT_OPTIONS).toContain(checkPrimary("#1d4ed8").buttonText);
  });

  it("refuses pale yellow however it is paired", () => {
    expect(checkPrimary("#fff8b0").ok).toBe(false);
  });
});

describe("theme backgrounds", () => {
  it("are the pocketclerk theme's base-100 and base-200", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const theme = css.split('name: "pocketclerk"')[1].split("}")[0];
    expect(theme).toContain(`--color-base-100: ${THEME_BACKGROUNDS[0]}`);
    expect(theme).toContain(`--color-base-200: ${THEME_BACKGROUNDS[1]}`);
    expect(theme).toContain(`--color-primary: ${DEFAULT_PRIMARY}`);
  });
});
