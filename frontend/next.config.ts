/**
 * Next.js configuration — enables standalone output for
 * optimized Docker builds (copies only needed files).
 */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
