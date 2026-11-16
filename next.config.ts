import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ["pg"],
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
    // Dynamic storefront/marketplace pages must never serve stale cached RSC
    // payloads after a store or product is deleted.
    staleTimes: { dynamic: 0, static: 60 },
  },
};

export default nextConfig;
