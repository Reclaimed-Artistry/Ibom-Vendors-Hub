"use server";

import { headers } from "next/headers";
import { systemDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/** Extract the client IP from request headers. */
async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can be a comma-separated list; take the first (client) IP
    return forwarded.split(",")[0].trim();
  }
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  return "0.0.0.0";
}

/** Record a site visit (called from root layout). */
export async function trackSiteVisit(path: string): Promise<void> {
  try {
    const ip = await getClientIp();
    const user = await getCurrentUser();
    const h = await headers();
    const userAgent = h.get("user-agent") ?? null;
    const referrer = h.get("referer") ?? null;

    await systemDb.execute(
      `insert into site_visitors (ip, path, user_id, user_role, referrer, user_agent)
       values ($1, $2, $3, $4, $5, $6)`,
      [ip, path, user?.id ?? null, user?.role ?? null, referrer, userAgent],
    );
  } catch {
    // Tracking must never break page rendering
  }
}

/** Record a storefront view (called from /s/[slug] page). */
export async function trackStoreView(storeId: string): Promise<void> {
  try {
    const ip = await getClientIp();
    const user = await getCurrentUser();

    await systemDb.execute(
      `insert into store_views (store_id, ip, user_id, user_role)
       values ($1, $2, $3, $4)`,
      [storeId, ip, user?.id ?? null, user?.role ?? null],
    );
  } catch {
    // Tracking must never break page rendering
  }
}

/** Record a product view (called from product detail page). */
export async function trackProductView(productId: string): Promise<void> {
  try {
    const ip = await getClientIp();
    const user = await getCurrentUser();

    await systemDb.execute(
      `insert into product_views (product_id, ip, user_id, user_role)
       values ($1, $2, $3, $4)`,
      [productId, ip, user?.id ?? null, user?.role ?? null],
    );
  } catch {
    // Tracking must never break page rendering
  }
}

/** Admin analytics: site visitor totals. */
export async function getSiteVisitorStats() {
  const [total, loggedIn, anonymous, today] = await Promise.all([
    systemDb.maybeOne<{ count: number }>(
      `select count(*)::int as count from site_visitors`,
    ),
    systemDb.maybeOne<{ count: number }>(
      `select count(*)::int as count from site_visitors where user_id is not null`,
    ),
    systemDb.maybeOne<{ count: number }>(
      `select count(*)::int as count from site_visitors where user_id is null`,
    ),
    systemDb.maybeOne<{ count: number }>(
      `select count(*)::int as count from site_visitors
       where created_at >= now() - interval '24 hours'`,
    ),
  ]);

  return {
    total: total?.count ?? 0,
    loggedIn: loggedIn?.count ?? 0,
    anonymous: anonymous?.count ?? 0,
    today: today?.count ?? 0,
  };
}

/** Admin analytics: top stores by view count. */
export async function getTopStoresByViews(limit = 10) {
  return systemDb.query<{
    store_id: string;
    store_name: string;
    store_slug: string;
    owner_email: string;
    view_count: number;
    unique_ips: number;
  }>(
    `select
       s.id as store_id,
       s.name as store_name,
       s.slug as store_slug,
       u.email as owner_email,
       count(*)::int as view_count,
       count(distinct sv.ip)::int as unique_ips
     from store_views sv
     join stores s on s.id = sv.store_id
     join users u on u.id = s.owner_id
     group by s.id, s.name, s.slug, u.email
     order by view_count desc
     limit $1`,
    [limit],
  );
}

/** Admin analytics: recent store views (visitor log). */
export async function getRecentStoreViews(limit = 20) {
  return systemDb.query<{
    id: string;
    store_id: string;
    store_name: string;
    ip: string;
    user_email: string | null;
    user_role: string | null;
    created_at: string;
  }>(
    `select
       sv.id,
       sv.store_id,
       s.name as store_name,
       sv.ip,
       u.email as user_email,
       sv.user_role,
       sv.created_at
     from store_views sv
     join stores s on s.id = sv.store_id
     left join users u on u.id = sv.user_id
     order by sv.created_at desc
     limit $1`,
    [limit],
  );
}

/** Admin analytics: top products by view count. */
export async function getTopProductsByViews(limit = 10) {
  return systemDb.query<{
    product_id: string;
    product_name: string;
    store_id: string;
    store_name: string;
    store_slug: string;
    view_count: number;
    unique_ips: number;
  }>(
    `select
       pv.product_id,
       p.name as product_name,
       p.store_id,
       s.name as store_name,
       s.slug as store_slug,
       count(*)::int as view_count,
       count(distinct pv.ip)::int as unique_ips
     from product_views pv
     join products p on p.id = pv.product_id
     join stores s on s.id = p.store_id
     group by pv.product_id, p.name, p.store_id, s.name, s.slug
     order by view_count desc
     limit $1`,
    [limit],
  );
}

/** Vendor analytics: store view stats for a specific store. */
export async function getVendorStoreViewStats(storeId: string) {
  const [total, uniqueIps, today, recent] = await Promise.all([
    systemDb.maybeOne<{ count: number }>(
      `select count(*)::int as count from store_views where store_id = $1`,
      [storeId],
    ),
    systemDb.maybeOne<{ count: number }>(
      `select count(distinct ip)::int as count from store_views where store_id = $1`,
      [storeId],
    ),
    systemDb.maybeOne<{ count: number }>(
      `select count(*)::int as count from store_views
       where store_id = $1 and created_at >= now() - interval '24 hours'`,
      [storeId],
    ),
    systemDb.query<{
      id: string;
      ip: string;
      user_email: string | null;
      user_role: string | null;
      created_at: string;
    }>(
      `select
         sv.id,
         sv.ip,
         u.email as user_email,
         sv.user_role,
         sv.created_at
       from store_views sv
       left join users u on u.id = sv.user_id
       where sv.store_id = $1
       order by sv.created_at desc
       limit 10`,
      [storeId],
    ),
  ]);

  return {
    total: total?.count ?? 0,
    uniqueIps: uniqueIps?.count ?? 0,
    today: today?.count ?? 0,
    recent,
  };
}

/** Vendor analytics: product view stats for a specific store's products. */
export async function getVendorProductViewStats(storeId: string) {
  const [total, topProducts] = await Promise.all([
    systemDb.maybeOne<{ count: number }>(
      `select count(*)::int as count from product_views pv
       join products p on p.id = pv.product_id
       where p.store_id = $1`,
      [storeId],
    ),
    systemDb.query<{
      product_id: string;
      product_name: string;
      product_slug: string;
      view_count: number;
      unique_ips: number;
    }>(
      `select
         pv.product_id,
         p.name as product_name,
         p.slug as product_slug,
         count(*)::int as view_count,
         count(distinct pv.ip)::int as unique_ips
       from product_views pv
       join products p on p.id = pv.product_id
       where p.store_id = $1
       group by pv.product_id, p.name, p.slug
       order by view_count desc
       limit 10`,
      [storeId],
    ),
  ]);

  return {
    total: total?.count ?? 0,
    topProducts,
  };
}

/** Admin analytics: per-store view totals (all stores). */
export async function getAllStoreViewStats() {
  return systemDb.query<{
    store_id: string;
    store_name: string;
    store_slug: string;
    owner_email: string;
    view_count: number;
    unique_ips: number;
    last_viewed: string | null;
  }>(
    `select
       s.id as store_id,
       s.name as store_name,
       s.slug as store_slug,
       u.email as owner_email,
       count(sv.id)::int as view_count,
       count(distinct sv.ip)::int as unique_ips,
       max(sv.created_at) as last_viewed
     from stores s
     join users u on u.id = s.owner_id
     left join store_views sv on sv.store_id = s.id
     group by s.id, s.name, s.slug, u.email
     order by view_count desc`
  );
}
