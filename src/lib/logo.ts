/**
 * The PocketClerk mark: a "P" printed on a receipt with a torn edge, on a
 * rounded tile.
 *
 * The product's mark, not a school's: per the white-label rule it is the same
 * on every deployment, and a deployment's own logo, if it has one, arrives as
 * `NEXT_PUBLIC_LOGO_URL` for the sign-in email. Chosen from three candidates
 * for staying crisp at 16px in a browser tab.
 *
 * These shapes are the only drawing of it. The `Logo` component draws them
 * inline; `scripts/render-icons.ts` renders the favicon and home-screen icons
 * from `logoSvg`; tests/logo.test.ts fails if the committed icon files drift.
 */

/** The tile, the receipt and the letter, in a 64-unit square. */
export const LOGO_SHAPES = {
  tileRadius: 14,
  receipt: "M18 10h28v44l-4.7-4-4.6 4-4.7-4-4.7 4-4.6-4-4.7 4z",
  letter: "M26 42V20h8a6.5 6.5 0 0 1 0 13h-8",
  letterWidth: 5.5,
} as const;

/**
 * Colours for the icon files only: the PocketClerk theme's primary and cream.
 * A favicon is loaded outside the page and cannot read the theme, so it needs
 * literal values. Inside the app the mark uses the theme's semantic colours
 * instead, per the no-ad-hoc-hex rule, and so it takes on a deployment's skin.
 */
export const LOGO_COLORS = { tile: "#0b6e5f", paper: "#fffcf7" } as const;

/**
 * The mark as standalone SVG markup, for the icon files.
 * `fullBleed` drops the rounded corners, for iOS, which rounds icons itself.
 */
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
