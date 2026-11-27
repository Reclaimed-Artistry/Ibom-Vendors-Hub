import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { systemDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  await requireAdmin();

  const [
    totalVisits,
    uniqueVisitors,
    visitorsLast24h,
    storeViews,
    storesWithViews,
    totalStores,
    topStores,
    topPages,
    recentVisits,
  ] = await Promise.all([
    systemDb.maybeOne<{ count: number }>(
      `select count(*)::int as count from page_visits`
    ),
    systemDb.maybeOne<{ count: number }>(
      `select count(distinct session_id)::int as count from page_visits`
    ),
    systemDb.maybeOne<{ count: number }>(
      `select count(distinct session_id)::int as count from page_visits
       where created_at >= now() - interval '24 hours'`
    ),
    systemDb.maybeOne<{ count: number }>(
      `select count(*)::int as count from page_visits where store_slug is not null`
    ),
    systemDb.maybeOne<{ count: number }>(
      `select count(distinct store_slug)::int as count from page_visits where store_slug is not null`
    ),
    systemDb.maybeOne<{ count: number }>(
      `select count(*)::int as count from stores`
    ),
    systemDb.query<{
      id: string;
      name: string;
      slug: string;
      views: number;
      unique_visitors: number;
      owner_name: string;
      owner_email: string;
    }>(
      `select s.id, s.name, s.slug,
              coalesce(count(pv.id), 0)::int as views,
              coalesce(count(distinct pv.session_id), 0)::int as unique_visitors,
              u.full_name as owner_name,
              u.email as owner_email
         from stores s
         join users u on u.id = s.owner_id
         left join page_visits pv on pv.store_slug = s.slug
        group by s.id, s.name, s.slug, u.full_name, u.email
        order by views desc, s.name asc
        limit 10`
    ),
    systemDb.query<{ path: string; views: number; visitors: number }>(
      `select path, count(*)::int as views, count(distinct session_id)::int as visitors
         from page_visits
        group by path
        order by views desc
        limit 10`
    ),
    systemDb.query<{
      id: string;
      session_id: string;
      path: string;
      referrer: string | null;
      user_agent: string | null;
      ip: string | null;
      created_at: string;
    }>(
      `select id, session_id, path, referrer, user_agent, ip, created_at
         from page_visits
        order by created_at desc
        limit 20`
    ),
  ]);

  return NextResponse.json({
    totalVisits: totalVisits?.count ?? 0,
    uniqueVisitors: uniqueVisitors?.count ?? 0,
    visitorsLast24h: visitorsLast24h?.count ?? 0,
    totalStoreViews: storeViews?.count ?? 0,
    storesWithViews: storesWithViews?.count ?? 0,
    totalStores: totalStores?.count ?? 0,
    topStores,
    topPages,
    recentVisits,
    updatedAt: new Date().toISOString(),
  });
}
