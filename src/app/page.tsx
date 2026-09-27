import { redirect } from "next/navigation";

import { siteMode } from "@/lib/site-mode";

import { Landing } from "./landing";

/** Landing page on the demo; redirects to the cart on a school's copy. */
export default function Home() {
  if (siteMode() !== "demo") redirect("/cart");
  return <Landing />;
}
