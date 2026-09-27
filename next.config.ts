import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the demo e2e server use a separate build folder; concurrent dev servers
  // sharing .next corrupt each other.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
