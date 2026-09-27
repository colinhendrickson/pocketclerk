/**
 * The deployment's main color: parsing it, and refusing one that would make
 * text hard to read.
 *
 * Pure functions, no database or React, so the rule is tested on its own. The
 * rule is WCAG 2.2 AA for normal text, 4.5:1, applied both ways the main
 * color is used: as the color of text and outlines on the page's light
 * backgrounds, and as the background of buttons, whose text is picked here to
 * be whichever of white or near-black reads better.
 */

/** WCAG AA for normal-size text. */
export const MIN_CONTRAST = 4.5;

/**
 * The light backgrounds the main color sits on: the pocketclerk theme's
 * base-100 (cards) and base-200 (the page). tests/colors.test.ts checks these
 * match src/app/globals.css.
 */
export const THEME_BACKGROUNDS = ["#fffcf7", "#f5f0e8"] as const;

/** Text on a main-color button: white, or the theme's near-black. */
export const BUTTON_TEXT_OPTIONS = ["#ffffff", "#1c2624"] as const;

/** The theme's own main color, restored by "Back to the original". */
export const DEFAULT_PRIMARY = "#0b6e5f";

/**
 * Ready-made blues, each already passing every check here, so choosing one
 * can never fail. Named for people, not for hex codes.
 */
export const PRESET_COLORS = [
  { name: "Navy", hex: "#1e3a8a" },
  { name: "Royal blue", hex: "#1d4ed8" },
  { name: "Classic blue", hex: "#1f4e8c" },
  { name: "Slate blue", hex: "#3b4f8f" },
  { name: "Teal (original)", hex: DEFAULT_PRIMARY },
] as const;

/**
 * "#1D4ED8", "1d4ed8" or "#14d" to "#1d4ed8"; anything else to null. The
 * stored form is always lower-case with six digits, which is also what the
 * database's CHECK constraint accepts.
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
  /** The weaker of its two readings against the page's light backgrounds. */
  onBackground: number;
  /** The button text color chosen for it, and how well that reads. */
  buttonText: string;
  onButton: number;
  /** When it fails: the nearest darker shade that passes. */
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

/** Whether a main color keeps every text readable, and a fix if it does not. */
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
