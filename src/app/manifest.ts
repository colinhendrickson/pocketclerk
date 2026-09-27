import type { MetadataRoute } from "next";

import { LOGO_COLORS } from "@/lib/logo";
import { PRODUCT_NAME } from "@/lib/site-mode";

/**
 * The web app manifest, for "Add to Home Screen" on the cart's iPad.
 *
 * Named after the product, not the cart: the manifest is public, and a
 * school's copy names the school only after sign-in. Opens full screen without the browser's
 * address bar, which is also what Guided Access expects. Colors are literal
 * because a manifest is read outside the page and cannot use the theme.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PRODUCT_NAME,
    short_name: PRODUCT_NAME,
    description: "Point of sale and work training for student-run carts",
    start_url: "/cart",
    display: "standalone",
    background_color: LOGO_COLORS.paper,
    theme_color: LOGO_COLORS.tile,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
