import type { MetadataRoute } from "next";

import { branding } from "@/lib/branding";
import { LOGO_COLORS } from "@/lib/logo";

/**
 * The web app manifest, for "Add to Home Screen" on the cart's iPad.
 *
 * Named after the cart rather than the product, because the name under the
 * icon is what students look for. Opens full screen without the browser's
 * address bar, which is also what Guided Access expects. Colours are literal
 * because a manifest is read outside the page and cannot use the theme.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: branding.cartName,
    short_name: branding.cartName,
    description: `${branding.cartName}, run by ${branding.programName}`,
    start_url: "/",
    display: "standalone",
    background_color: LOGO_COLORS.paper,
    theme_color: LOGO_COLORS.tile,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
