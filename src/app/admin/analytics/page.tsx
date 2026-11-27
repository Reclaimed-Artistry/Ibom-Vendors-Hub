import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { RealtimeAnalytics } from "@/components/realtime-analytics";

export const metadata: Metadata = { title: "Visitor analytics · Admin" };

interface DayStat {
  day: string;
  visits: number;
}

export default async function VisitorAnalyticsPage() {
  await requireAdmin();

  const [
    totalVisits,
    uniqueVisitors,
    loggedInVisitors,
    anonymousVisitors,
    visitorsLast24h,
    storeViews,
    storesWithViews,
    totalStores,
    topStores,
    topPages,
    dailyStats,
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
       where user_id is not null`
    ),
    systemDb.maybeOne<{ count: number }>(
      `select count(distinct session_id)::int as count from page_visits
       where user_id is null`
    ),
    systemDb.maybeOne<{ count: number }>(
      `select count(distinct session_id)::int as count from page_visits
       where created_at >= now() - interval '24 hours'`
    ),
    systemDb.maybeOne<{ count: number }>(
      `select count(*)::int as count from page_visits
       where store_slug is not null`
    ),
    systemDb.maybeOne<{ count: number }>(
      `select count(distinct store_slug)::int as count
         from page_visits
        where store_slug is not null`
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
    systemDb.query<DayStat>(
      `select (created_at at time zone 'Africa/Lagos')::date::text as day,
              count(*)::int as visits
         from page_visits
        where created_at >= (now() at time zone 'Africa/Lagos') - interval '13 days'
        group by 1
        order by 1`
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

  const total = totalVisits?.count ?? 0;
  const unique = uniqueVisitors?.count ?? 0;
  const last24h = visitorsLast24h?.count ?? 0;
  const totalStoreViews = storeViews?.count ?? 0;
  const storesViewed = storesWithViews?.count ?? 0;
  const totalStoreCount = totalStores?.count ?? 0;

  const nowLagos = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Africa/Lagos" }),
  );
  const days: DayStat[] = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date(nowLagos);
    d.setDate(d.getDate() - i);
    days.push({ day: d.toISOString().slice(0, 10), visits: 0 });
  }
  const byDay = new Map(dailyStats.map((row) => [row.day, row.visits]));
  days.forEach((day) => {
    day.visits = byDay.get(day.day) ?? 0;
  });

  const initialData = {
    totalVisits: total,
    uniqueVisitors: unique,
    visitorsLast24h: last24h,
    totalStoreViews: totalStoreViews,
    storesWithViews: storesViewed,
    totalStores: totalStoreCount,
    topStores,
    topPages,
    recentVisits,
    updatedAt: new Date().toISOString(),
  };

  return (
    <div className="space-y-4">
      <RealtimeAnalytics initialData={initialData} />
    </div>
  );
}
