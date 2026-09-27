/**
 * Parsing and contrast-checking the staff-chosen main color. The color must
 * meet WCAG AA (4.5:1) both as text on the theme backgrounds and as a button
 * background with the better of white or near-black text. Pure functions.
 * See docs/adr/0011-staff-chosen-main-color.md.
 */

/** WCAG AA for normal-size text. */
export const MIN_CONTRAST = 4.5;

/** Theme base-100 and base-200. Must match src/app/globals.css (tested). */
export const THEME_BACKGROUNDS = ["#fffcf7", "#f5f0e8"] as const;

/** Text on a main-color button: white, or the theme's near-black. */
export const BUTTON_TEXT_OPTIONS = ["#ffffff", "#1c2624"] as const;

/** The theme's own main color, restored by "Back to the original". */
export const DEFAULT_PRIMARY = "#0b6e5f";

/** Presets; each passes `checkPrimary`. */
export const PRESET_COLORS = [
  { name: "Navy", hex: "#1e3a8a" },
  { name: "Royal blue", hex: "#1d4ed8" },
  { name: "Classic blue", hex: "#1f4e8c" },
  { name: "Slate blue", hex: "#3b4f8f" },
  { name: "Teal (original)", hex: DEFAULT_PRIMARY },
] as const;

/**
 * Normalizes 3- or 6-digit hex (with or without `#`) to lowercase `#rrggbb`,
 * the form the database CHECK constraint accepts; otherwise null.
 */
export function normalizeHex(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim());
  if (!match) return null;
  const digits = match[1].toLowerCase();
  const six = digits.length === 3 ? [...digits].map((d) => d + d).join("") : digits;
  return `#${six}`;
}

function channels(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colors, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

export interface ColorCheck {
  ok: boolean;
  /** Minimum contrast against the theme backgrounds. */
  onBackground: number;
  buttonText: string;
  onButton: number;
  /** On failure, the nearest darker shade that passes. */
  suggestion: string | null;
}

function measure(hex: string) {
  const onBackground = Math.min(...THEME_BACKGROUNDS.map((bg) => contrastRatio(hex, bg)));
  const [buttonText, onButton] = BUTTON_TEXT_OPTIONS.map((text) => [text, contrastRatio(hex, text)] as const).sort(
    (x, y) => y[1] - x[1],
  )[0];
  return { onBackground, buttonText, onButton };
}

function passes(hex: string): boolean {
  const { onBackground, onButton } = measure(hex);
  return onBackground >= MIN_CONTRAST && onButton >= MIN_CONTRAST;
}

/** The same hue, darker by `step` of the way to black. */
function darken(hex: string, step: number): string {
  return `#${channels(hex)
    .map((c) => Math.round(c * (1 - step)).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Checks a main color's contrast and suggests a darker fix if it fails. */
export function checkPrimary(hex: string): ColorCheck {
  const { onBackground, buttonText, onButton } = measure(hex);
  const ok = onBackground >= MIN_CONTRAST && onButton >= MIN_CONTRAST;

  let suggestion: string | null = null;
  if (!ok) {
    for (let step = 0.05; step < 1; step += 0.05) {
      const darker = darken(hex, step);
      if (passes(darker)) {
        suggestion = darker;
        break;
      }
    }
  }

  return { ok, onBackground, buttonText, onButton, suggestion };
}
