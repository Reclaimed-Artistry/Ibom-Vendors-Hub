import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ["pg"],
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
    // Client-side router cache: revisiting a page (or going back) paints from
    // memory instead of re-fetching the whole RSC payload. Mutations still call
    // revalidatePath, which clears the affected entries immediately.
    staleTimes: { dynamic: 30, static: 300 },
  },
};

export default nextConfig;
