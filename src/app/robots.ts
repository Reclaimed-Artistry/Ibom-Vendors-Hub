import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { robotsForHost } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  return robotsForHost((await headers()).get("host"));
}
