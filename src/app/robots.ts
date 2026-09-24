import type { MetadataRoute } from "next";

import { siteMode } from "@/lib/site-mode";

/**
 * A school's copy asks every search engine to stay away: nothing on it is meant
 * to be found. pocket-clerk.com, the demo, is meant to be.
 */
export default function robots(): MetadataRoute.Robots {
  return siteMode() === "demo"
    ? { rules: { userAgent: "*", allow: "/" } }
    : { rules: { userAgent: "*", disallow: "/" } };
}
