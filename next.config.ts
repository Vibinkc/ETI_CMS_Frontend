import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone: a self-contained server with only the packages it
  // actually imports, so the runtime image needs no node_modules copy.
  output: "standalone",

  // Same exposure as the public site: the banner helps nobody but an attacker,
  // and an admin tool is the worse place of the two to leak a stack from.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // The CMS is never meant to be framed by anything.
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
