import { NextRequest, NextResponse } from "next/server";
import { appUrl, isReservedSubdomain, rootDomain, storefrontUrl, subdomainFromHost } from "@/lib/domains";
import { crawlerContext, isNonIndexablePath } from "@/lib/seo";
import { PUBLIC_BRAND_ASSET_PATHS } from "@/lib/brand-assets";
import { getLoanAgents } from "@/lib/loan-agents";

function base64UrlDecode(input: string): string {
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  try {
    return decodeURIComponent(
      atob(base64).split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""),
    );
  } catch {
    return "";
  }
}

async function getSessionUser(request: NextRequest): Promise<{ email: string; role: string } | null> {
  const token =
    request.cookies.get("ivh_session_shared")?.value ||
    request.cookies.get("ivh_session")?.value;
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    return {
      email: String(payload.email ?? ""),
      role: String(payload.role ?? ""),
    };
  } catch {
    return null;
  }
}

/**
 * Loan agents (registered loan officers who are not super_admins) must only
 * access loan-related routes. Block them from all non-loan pages and
 * redirect to /agent/loans.
 */
const LOAN_AGENT_ALLOWED_PATHS = [
  "/agent/loans",
  "/agent/loan-assessments",
  "/agent/agents",
  "/admin/loan-assessments",
  "/admin/loans",
  "/login",
  "/logout",
  "/forbidden",
];

function isLoanAgentAllowedPath(pathname: string): boolean {
  if (LOAN_AGENT_ALLOWED_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/admin/loan-assessments/")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/api")) return true;
  if (pathname === "/" || pathname.startsWith("/auth")) return true;
  return false;
}

// Platform routes must never be rewritten into non-existent tenant pages.
const PUBLIC_PLATFORM_ROUTES = /^\/(browse|stores|about|contact|terms|privacy|sell)(?:\/|$)/;
const PLATFORM_ROUTES = /^\/(checkout|cart|pay|login|logout|register|forgot-password|reset-password|verify-email|auth|account|vendor|admin|track|forbidden)(?:\/|$)/;
const PUBLIC_BRAND_PATHS = new Set<string>(PUBLIC_BRAND_ASSET_PATHS);
const CRAWLER_PATHS = new Set(["/robots.txt", "/sitemap.xml"]);
const PASSTHROUGH_PREFIXES = ["/api", "/_next", "/s/", "/uploads/", "/favicon", "/images", "/brand/"];

function applyNoStoreHeaders(response: NextResponse, request: NextRequest) {
  response.headers.set("Cache-Control", "private, no-cache, no-store, max-age=0, must-revalidate");
  response.headers.set("CDN-Cache-Control", "no-store");
  response.headers.set("Vercel-CDN-Cache-Control", "no-store");
  if (!crawlerContext(request.headers.get("host")).indexable || isNonIndexablePath(request.nextUrl.pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  } else if (request.nextUrl.searchParams.get("q")?.trim()) {
    response.headers.set("X-Robots-Tag", "noindex, follow");
  }
  return response;
}

/**
 * Wildcard subdomain routing + strict no-store cache headers on HTML/RSC routes.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get("host");
  const subdomain = subdomainFromHost(host);
  const root = rootDomain();
  const hostname = (host ?? "").toLowerCase();
  const legacyStorePath = pathname.match(/^\/s\/([a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?)(\/.*)?$/);
  const safeMethod = request.method === "GET" || request.method === "HEAD";

  // Marketplace navigation on a store host must reach the actual marketplace,
  // not a /s/vendor/browse 404 or another indexable copy of a platform page.
  if (subdomain && !isReservedSubdomain(subdomain) && PUBLIC_PLATFORM_ROUTES.test(pathname) && safeMethod) {
    return applyNoStoreHeaders(NextResponse.redirect(new URL(`${pathname}${search}`, `${appUrl()}/`), 301), request);
  }

  // Only canonical website hosts redirect. Local development and preview hosts
  // retain path-based storefront access without requiring wildcard DNS.
  if (
    safeMethod &&
    !root.startsWith("localhost") && !root.startsWith("127.0.0.1") &&
    (hostname === root || hostname === `www.${root}` || Boolean(subdomain && !isReservedSubdomain(subdomain))) &&
    legacyStorePath && !isReservedSubdomain(legacyStorePath[1])
  ) {
    const destination = new URL(storefrontUrl(legacyStorePath[1]));
    destination.pathname = legacyStorePath[2] || "/";
    destination.search = search;
    return applyNoStoreHeaders(NextResponse.redirect(destination, 301), request);
  }

  // Public, fixed brand artwork is independent of tenant/preview routing and
  // must not inherit a page's noindex headers or require a storefront/login.
  if (PUBLIC_BRAND_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // Both files are host-aware. Do not rewrite tenant /robots.txt or
  // /sitemap.xml to non-existent storefront child routes.
  if (CRAWLER_PATHS.has(pathname)) {
    return applyNoStoreHeaders(NextResponse.next(), request);
  }

  if (!subdomain || isReservedSubdomain(subdomain) || PLATFORM_ROUTES.test(pathname) || PUBLIC_PLATFORM_ROUTES.test(pathname)) {
    if (pathname === "/checkout" && !(request.cookies.get("ivh_session_shared")?.value || request.cookies.get("ivh_session")?.value)) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
      return applyNoStoreHeaders(NextResponse.redirect(loginUrl), request);
    }

    // Restrict loan agents (non-super-admin) to loan-related routes only.
    const sessionUser = await getSessionUser(request);
    if (
      sessionUser &&
      sessionUser.role !== "super_admin" &&
      getLoanAgents().some((agent) => agent.email === sessionUser.email) &&
      !isLoanAgentAllowedPath(pathname)
    ) {
      return applyNoStoreHeaders(NextResponse.redirect(new URL("/agent/loans", request.nextUrl.origin)), request);
    }

    const headers = new Headers(request.headers);
    headers.set("x-ivh-pathname", pathname);
    const response = NextResponse.next({ request: { headers } });
    response.headers.set("x-ivh-root", "1");
    return applyNoStoreHeaders(response, request);
  }

  if (PASSTHROUGH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return applyNoStoreHeaders(NextResponse.next(), request);
  }

  const url = request.nextUrl.clone();
  url.pathname = `/s/${subdomain}${pathname === "/" ? "" : pathname}`;
  url.search = search;

  const headers = new Headers(request.headers);
  headers.set("x-store-slug", subdomain);
  headers.set("x-store-base", "");
  headers.set("x-ivh-host", host ?? "");

  return applyNoStoreHeaders(NextResponse.rewrite(url, { request: { headers } }), request);
}

export const config = {
  // The local-only media sink must stream, not pass through middleware's 10 MB
  // request-body clone. These handlers perform their own auth/origin checks.
  // Hosted uploads use signed Storage URLs and never send file bodies here.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images|uploads|api/vendor-media/).*)"],
};
