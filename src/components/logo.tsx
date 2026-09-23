import { LOGO_SHAPES } from "@/lib/logo";

export interface LogoProps {
  /** Rendered width and height in px. */
  size?: number;
  /** Layout-only extras. */
  className?: string;
}

/**
 * The PocketClerk mark, inline. The drawing lives in src/lib/logo.ts.
 *
 * Coloured with the theme's semantic colours rather than the icon files'
 * fixed ones, so it follows a deployment's skin. Decorative: it always sits
 * beside the cart or product name, which already says what it is, so screen
 * readers skip it.
 */
export function Logo({ size = 32, className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className ?? ""}`}
    >
      <rect width="64" height="64" rx={LOGO_SHAPES.tileRadius} className="fill-primary" />
      <path d={LOGO_SHAPES.receipt} className="fill-base-100" />
      <path
        d={LOGO_SHAPES.letter}
        fill="none"
        className="stroke-primary"
        strokeWidth={LOGO_SHAPES.letterWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
