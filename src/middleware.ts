import { NextRequest, NextResponse } from "next/server";
import { isReservedSubdomain, rootDomain, storefrontUrl, subdomainFromHost } from "@/lib/domains";

// Platform routes must never be rewritten into non-existent tenant pages.
const PLATFORM_ROUTES = /^\/(checkout|cart|pay|login|logout|register|forgot-password|reset-password|auth|account|vendor|admin|track|forbidden)(?:\/|$)/;
const PASSTHROUGH_PREFIXES = ["/api", "/_next", "/s/", "/uploads/", "/favicon", "/images", "/brand/"];

function applyNoStoreHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-cache, no-store, max-age=0, must-revalidate");
  response.headers.set("CDN-Cache-Control", "no-store");
  response.headers.set("Vercel-CDN-Cache-Control", "no-store");
  return response;
}

/**
 * Wildcard subdomain routing + strict no-store cache headers on HTML/RSC routes.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get("host");
  const subdomain = subdomainFromHost(host);
  const root = rootDomain();
  const hostname = (host ?? "").toLowerCase();
  const legacyStorePath = pathname.match(/^\/s\/([a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?)(\/.*)?$/);

  // Only canonical website hosts redirect. Local development and preview hosts
  // retain path-based storefront access without requiring wildcard DNS.
  if (
    (request.method === "GET" || request.method === "HEAD") &&
    !root.startsWith("localhost") && !root.startsWith("127.0.0.1") &&
    (hostname === root || hostname === `www.${root}` || Boolean(subdomain && !isReservedSubdomain(subdomain))) &&
    legacyStorePath && !isReservedSubdomain(legacyStorePath[1])
  ) {
    const destination = new URL(storefrontUrl(legacyStorePath[1]));
    destination.pathname = legacyStorePath[2] || "/";
    destination.search = search;
    return applyNoStoreHeaders(NextResponse.redirect(destination, 308));
  }

  if (!subdomain || isReservedSubdomain(subdomain) || PLATFORM_ROUTES.test(pathname)) {
    if (pathname === "/checkout" && !request.cookies.get("ivh_session")?.value) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
      return applyNoStoreHeaders(NextResponse.redirect(loginUrl));
    }
    const headers = new Headers(request.headers);
    headers.set("x-ivh-pathname", pathname);
    const response = NextResponse.next({ request: { headers } });
    response.headers.set("x-ivh-root", "1");
    return applyNoStoreHeaders(response);
  }

  if (PASSTHROUGH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return applyNoStoreHeaders(NextResponse.next());
  }

  const url = request.nextUrl.clone();
  url.pathname = `/s/${subdomain}${pathname === "/" ? "" : pathname}`;
  url.search = search;

  const headers = new Headers(request.headers);
  headers.set("x-store-slug", subdomain);
  headers.set("x-store-base", "");
  headers.set("x-ivh-host", host ?? "");

  return applyNoStoreHeaders(NextResponse.rewrite(url, { request: { headers } }));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images|uploads).*)"],
};
