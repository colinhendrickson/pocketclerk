import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The demo's end-to-end server runs beside the ordinary one and needs its own
  // build folder; two dev servers sharing .next corrupt each other.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
