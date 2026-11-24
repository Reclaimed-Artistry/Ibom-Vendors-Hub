import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  serverExternalPackages: ["pg"],
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
    // Zero client router caching for both dynamic and static/prefetched segments
    // so deleted products or storefronts vanish everywhere immediately.
    staleTimes: { dynamic: 0, static: 0 },
  },
};

export default nextConfig;
