import type { MetadataRoute } from "next";

import { LOGO_COLORS } from "@/lib/logo";
import { PRODUCT_NAME } from "@/lib/site-mode";

/**
 * Web app manifest for "Add to Home Screen". Uses the product name because the
 * manifest is public. Colors are literal since the theme is unavailable here.
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
