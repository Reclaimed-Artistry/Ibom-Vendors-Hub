import { NextRequest, NextResponse } from "next/server";
import { isReservedSubdomain, subdomainFromHost } from "@/lib/domains";

const PASSTHROUGH_PREFIXES = ["/api", "/_next", "/s/", "/uploads/", "/favicon", "/images"];

/**
 * Wildcard subdomain routing.
 *
 *   https://royalfashion.ibomvendorshub.com/products/bag
 *        → /s/royalfashion/products/bag
 *
 * The storefront routes under /s/[slug] can also be reached directly (useful on
 * localhost and on preview deployments where wildcard DNS is not available).
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get("host");
  const subdomain = subdomainFromHost(host);

  if (!subdomain || isReservedSubdomain(subdomain)) {
    const headers = new Headers(request.headers);
    headers.set("x-ivh-pathname", pathname);
    const response = NextResponse.next({ request: { headers } });
    response.headers.set("x-ivh-root", "1");
    return response;
  }

  if (PASSTHROUGH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/s/${subdomain}${pathname === "/" ? "" : pathname}`;
  url.search = search;

  const headers = new Headers(request.headers);
  headers.set("x-store-slug", subdomain);
  headers.set("x-store-base", "");
  headers.set("x-ivh-host", host ?? "");

  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images|uploads).*)"],
};
