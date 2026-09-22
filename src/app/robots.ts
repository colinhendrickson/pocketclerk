import type { MetadataRoute } from "next";

/**
 * Nothing here should be in a search engine.
 *
 * This is a school tool for one cart, not a website. Even with device pairing in
 * front of the student screens, an indexed URL is an invitation, and the sign-in
 * page carries the school's name.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
