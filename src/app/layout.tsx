import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { DemoBanner, RouteFocus, SkipLink } from "@/components";
import { maybeResetDemo } from "@/lib/demo";
import { siteMode } from "@/lib/site-mode";

import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "PocketClerk",
  description: "Student-run cart POS and work-readiness training",
  // A school's copy is not meant to be found; the demo is.
  ...(siteMode() === "instance" ? { robots: { index: false, follow: false } } : {}),
};

// Not typed with Next's generated `LayoutProps`, which only exists after a
// build and would break `tsc` on a clean checkout.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // No-op outside the demo.
  await maybeResetDemo();
  return (
    <html
      lang="en"
      data-theme="pocketclerk"
      className={`${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-base-100 text-base-content">
        <SkipLink />
        <RouteFocus />
        {siteMode() === "demo" && <DemoBanner />}
        {children}
      </body>
    </html>
  );
}
