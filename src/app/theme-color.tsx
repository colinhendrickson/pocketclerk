import { checkPrimary, normalizeHex } from "@/lib/colors";
import { getPrimaryColor } from "@/lib/settings";

/**
 * Overrides the theme's primary color with the admin-chosen one. Rendered by
 * the admin and student layouts (already dynamic), not the root layout, so
 * static pages and `next build` need no database. The value reaches CSS
 * unescaped, so it is re-validated here despite the database CHECK constraint.
 * See docs/adr/0011-staff-chosen-main-color.md.
 */
export async function ThemeColor() {
  const stored = await getPrimaryColor();
  const color = normalizeHex(stored);
  if (!color) return null;

  const { buttonText } = checkPrimary(color);
  return (
    <style>{`html[data-theme]{--color-primary:${color};--color-primary-content:${buttonText};}`}</style>
  );
}
