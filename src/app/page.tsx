import { redirect } from "next/navigation";

import { siteMode } from "@/lib/site-mode";

import { Landing } from "./landing";

/**
 * The bare address. On the demo it is the landing page. On a school's copy
 * there is nothing here but the cart, so old bookmarks and the iPad's
 * home-screen icon still reach the student list.
 */
export default function Home() {
  if (siteMode() !== "demo") redirect("/cart");
  return <Landing />;
}
