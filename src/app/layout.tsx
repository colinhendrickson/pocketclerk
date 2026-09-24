import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { RouteFocus, SkipLink } from "@/components";
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

// Typed explicitly rather than with Next's generated `LayoutProps`, which only
// exists after a build has written .next/types and therefore breaks `tsc` on a
// clean checkout — including in CI, where typecheck runs before build.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="pocketclerk"
      className={`${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-base-100 text-base-content">
        <SkipLink />
        <RouteFocus />
        {children}
      </body>
    </html>
  );
}
