import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { sitemapForHost } from "@/lib/seo-data";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return sitemapForHost((await headers()).get("host"));
}
