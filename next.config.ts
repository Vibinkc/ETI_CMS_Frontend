import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone: a self-contained server with only the packages it
  // actually imports, so the runtime image needs no node_modules copy.
  output: "standalone",
};

export default nextConfig;
