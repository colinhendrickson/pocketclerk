import type { MetadataRoute } from "next";

import { siteMode } from "@/lib/site-mode";

/** Only the demo is indexable. */
export default function robots(): MetadataRoute.Robots {
  return siteMode() === "demo"
    ? { rules: { userAgent: "*", allow: "/" } }
    : { rules: { userAgent: "*", disallow: "/" } };
}
