/**
 * The PocketClerk mark, identical on every deployment. These shapes are the
 * single source: the `Logo` component draws them inline, and
 * `scripts/render-icons.ts` renders the icon files from `logoSvg`
 * (tests/logo.test.ts catches drift).
 */

/** Tile, receipt and letter paths in a 64-unit square. */
export const LOGO_SHAPES = {
  tileRadius: 14,
  receipt: "M18 10h28v44l-4.7-4-4.6 4-4.7-4-4.7 4-4.6-4-4.7 4z",
  letter: "M26 42V20h8a6.5 6.5 0 0 1 0 13h-8",
  letterWidth: 5.5,
} as const;

/**
 * Literal colors for the icon files only, which load outside the page and
 * cannot read the theme. In the app the mark uses semantic theme colors.
 */
export const LOGO_COLORS = { tile: "#0b6e5f", paper: "#fffcf7" } as const;

/** Standalone SVG for the icon files. `fullBleed` drops the corners (iOS rounds its own). */
export function logoSvg({ fullBleed = false }: { fullBleed?: boolean } = {}): string {
  const { tile, paper } = LOGO_COLORS;
  const rx = fullBleed ? 0 : LOGO_SHAPES.tileRadius;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`,
    `<rect width="64" height="64" rx="${rx}" fill="${tile}"/>`,
    `<path d="${LOGO_SHAPES.receipt}" fill="${paper}"/>`,
    `<path d="${LOGO_SHAPES.letter}" fill="none" stroke="${tile}" stroke-width="${LOGO_SHAPES.letterWidth}" stroke-linecap="round" stroke-linejoin="round"/>`,
    `</svg>`,
    "",
  ].join("\n");
}
