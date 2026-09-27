import { checkPrimary, normalizeHex } from "@/lib/colors";
import { getPrimaryColor } from "@/lib/settings";

/**
 * Applies the main color chosen on the admin Colors page, over the theme's.
 *
 * Rendered by the admin and student layouts rather than the root one: those
 * pages are dynamic anyway, while a database read in the root layout would put
 * one into every static page and into `next build`, which runs with no
 * database. Overrides only the main color and the text on it; daisyUI derives
 * hover and focus shades from these at runtime.
 *
 * The value reaches CSS unescaped, so it is re-checked here: the database's
 * CHECK constraint already allows only `#rrggbb`, and this does not rely on it.
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
