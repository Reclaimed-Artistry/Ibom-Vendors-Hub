import type { Metadata, MetadataRoute } from "next";
import { appUrl, isReservedSubdomain, storefrontUrl, subdomainFromHost } from "@/lib/domains";

export const SITE_NAME = "Ibom Vendors Hub";
export const SITE_DESCRIPTION =
  "Shop products and book services from verified vendors in Uyo and across Akwa Ibom, Nigeria. Discover local businesses or open your own free online storefront.";

export const NO_INDEX: Metadata["robots"] = { index: false, follow: false, nocache: true };
export const PUBLIC_ROBOTS: Metadata["robots"] = {
  index: true,
  follow: true,
  googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
};

export function siteUrl(path = "/") {
  return new URL(path, `${appUrl()}/`).toString();
}

export function storeUrl(slug: string, path = "/") {
  return new URL(path, `${storefrontUrl(slug)}/`).toString();
}

/** Keep snippets readable without cutting a word or publishing raw markup. */
export function seoDescription(value: string | null | undefined, fallback = SITE_DESCRIPTION, limit = 160) {
  const text = (value || fallback).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || fallback;
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut}…`;
}

export function publicMetadata(input: {
  title: string;
  description: string;
  url: string;
  image?: string | null;
  index?: boolean;
}): Metadata {
  const description = seoDescription(input.description);
  let image = siteUrl("/brand/og-image.png");
  if (input.image) {
    try {
      const candidate = new URL(input.image, input.url);
      if (["https:", "http:"].includes(candidate.protocol)) image = candidate.toString();
    } catch { /* A malformed vendor image must not break metadata rendering. */ }
  }
  return {
    title: { absolute: input.title },
    description,
    alternates: { canonical: input.url },
    robots: input.index === false ? { index: false, follow: true } : PUBLIC_ROBOTS,
    openGraph: {
      type: "website",
      locale: "en_NG",
      siteName: SITE_NAME,
      title: input.title,
      description,
      url: input.url,
      images: [{ url: image, alt: input.title }],
    },
    twitter: { card: "summary_large_image", title: input.title, description, images: [image] },
  };
}

/** Never let a forwarded/unrecognised host become a canonical URL. */
export function crawlerContext(host: string | null | undefined) {
  const hostname = (host ?? "").toLowerCase().split(":")[0];
  const platformHost = new URL(appUrl()).hostname;
  const slug = subdomainFromHost(host);
  if (slug && !isReservedSubdomain(slug)) {
    return { slug, origin: storefrontUrl(slug), indexable: true };
  }
  return { slug: null, origin: appUrl(), indexable: hostname === platformHost };
}

// Authenticated endpoints are not crawl targets. CSS, JS and images remain
// crawlable; public transactional forms use noindex rather than a robots block.
export const ROBOTS_DISALLOW = ["/api/", "/admin", "/vendor", "/account", "/auth/"];

export function robotsForHost(host: string | null): MetadataRoute.Robots {
  const context = crawlerContext(host);
  if (!context.indexable) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ROBOTS_DISALLOW }],
    sitemap: `${context.origin}/sitemap.xml`,
  };
}

/** HTTP-level noindex also covers redirects, APIs and deployment aliases. */
export function isNonIndexablePath(pathname: string) {
  return /^\/(admin|vendor|account|api|auth|login|logout|register|forgot-password|reset-password|verify-email|cart|checkout|pay|track|forbidden|book|quote)(?:\/|$)/.test(pathname)
    || /^\/s\/[^/]+\/(book|quote)(?:\/|$)/.test(pathname);
}

export function listingPage(value: string | undefined) {
  const page = Number(value ?? "1");
  return Number.isSafeInteger(page) && page > 1 ? page : 1;
}

/** Sorted/filter permutations share a canonical; internal search is noindex. */
export function listingCanonical(path: string, input: { category?: string; page?: string; kind?: string }) {
  const url = new URL(path);
  if (input.category) url.searchParams.set("category", input.category);
  if (input.kind === "product" || input.kind === "service") url.searchParams.set("kind", input.kind);
  const page = listingPage(input.page);
  if (page > 1) url.searchParams.set("page", String(page));
  return url.toString();
}

export function siteVerification(): Metadata["verification"] {
  const google = process.env.GOOGLE_SITE_VERIFICATION?.trim();
  const bing = process.env.BING_SITE_VERIFICATION?.trim();
  return {
    ...(google ? { google } : {}),
    ...(bing ? { other: { "msvalidate.01": bing } } : {}),
  };
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
