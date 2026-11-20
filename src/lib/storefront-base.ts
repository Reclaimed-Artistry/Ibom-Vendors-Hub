import { headers } from "next/headers";

/**
 * Returns the path prefix for storefront links.
 * On a vendor subdomain the middleware rewrites `/x` → `/s/slug/x`, and sets
 * `x-store-base` to "" so links stay clean (royalfashion.domain.com/products).
 * On localhost / preview URLs the prefix is `/s/<slug>`.
 */
export async function storeBase(slug: string) {
  const headerList = await headers();
  const base = headerList.get("x-store-base");
  if (base !== null) return base;
  return `/s/${slug}`;
}
