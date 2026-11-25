import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { formatDateTime, timeAgo } from "@/lib/utils";
import { PageHeader, StatCard, EmptyState } from "@/components/ui";
import {
  Activity,
  Monitor,
  Users,
  Globe,
  Clock,
  Store,
  User,
  TrendingUp,
} from "lucide-react";

export const metadata: Metadata = { title: "Visitor analytics · Admin" };

interface DayStat {
  day: string;
  visits: number;
}

interface VisitRow {
  id: string;
  session_id: string;
  path: string;
  referrer: string | null;
  user_agent: string | null;
  ip: string | null;
  created_at: string;
}

interface StoreRow {
  id: string;
  name: string;
  slug: string;
  views: number;
  unique_visitors: number;
  owner_name: string;
  owner_email: string;
}

function deviceName(userAgent: string | null): string {
  const ua = (userAgent ?? "").toLowerCase();
  if (/ipad|tablet/.test(ua)) return "Tablet";
  if (/mobile|android|iphone|ipod/.test(ua)) return "Mobile";
  return "Desktop";
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
      `select count(*)::int as count from page_visits`,
    ),
    systemDb.maybeOne<{ count: number }>(
      `select count(distinct session_id)::int as count from page_visits`,
    ),
    systemDb.maybeOne<{ count: number }>(
      `select count(distinct session_id)::int as count from page_visits
       where user_id is not null`,
    ),
    systemDb.maybeOne<{ count: number }>(
      `select count(distinct session_id)::int as count from page_visits
       where user_id is null`,
    ),
    systemDb.maybeOne<{ count: number }>(
      `select count(distinct session_id)::int as count from page_visits
       where created_at >= now() - interval '24 hours'`,
    ),
    systemDb.maybeOne<{ count: number }>(
      `select count(*)::int as count from page_visits
       where path like '/s/%'`,
    ),
    systemDb.maybeOne<{ count: number }>(
      `select count(distinct s.slug)::int as count
         from page_visits pv
         join stores s on s.slug = split_part(pv.path, '/', 3)
        where pv.path like '/s/%'`,
    ),
    systemDb.maybeOne<{ count: number }>(
      `select count(*)::int as count from stores`,
    ),
    systemDb.query<StoreRow>(
      `select s.id, s.name, s.slug,
              count(*)::int as views,
              count(distinct pv.session_id)::int as unique_visitors,
              u.full_name as owner_name,
              u.email as owner_email
         from page_visits pv
         join stores s on s.slug = split_part(pv.path, '/', 3)
         join users u on u.id = s.owner_id
        where pv.path like '/s/%'
        group by s.id, s.name, s.slug, u.full_name, u.email
        order by views desc
        limit 10`,
    ),
    systemDb.query<{ path: string; views: number; visitors: number }>(
      `select path, count(*)::int as views, count(distinct session_id)::int as visitors
         from page_visits
        group by path
        order by views desc
        limit 10`,
    ),
    systemDb.query<DayStat>(
      `select (created_at at time zone 'Africa/Lagos')::date::text as day,
              count(*)::int as visits
         from page_visits
        where created_at >= (now() at time zone 'Africa/Lagos') - interval '13 days'
        group by 1
        order by 1`,
    ),
    systemDb.query<VisitRow>(
      `select id, session_id, path, referrer, user_agent, ip, created_at
         from page_visits
        order by created_at desc
        limit 50`,
    ),
  ]);

  const total = totalVisits?.count ?? 0;
  const unique = uniqueVisitors?.count ?? 0;
  const loggedIn = loggedInVisitors?.count ?? 0;
  const anonymous = anonymousVisitors?.count ?? 0;
  const last24h = visitorsLast24h?.count ?? 0;
  const totalStoreViews = storeViews?.count ?? 0;
  const storesViewed = storesWithViews?.count ?? 0;
  const totalStoreCount = totalStores?.count ?? 0;

  // Last 14 days (Lagos time) with zeros filled in for days without visits.
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
  const maxVisits = Math.max(1, ...days.map((d) => d.visits));

  const topPath = topPages[0]?.path ?? "—";
  const topViews = topPages[0]?.views ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Visitor analytics"
        description={`Track site visitors, store views, and product views across the platform.`}
        actions={null}
      />

      {/* Site-wide visitors stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total site visitors"
          value={total}
          icon={<Monitor className="size-4" />}
          tone="neutral"
        />
        <StatCard
          label="Logged-in visitors"
          value={loggedIn}
          hint={`${Math.round(((loggedIn || 0) / Math.max(unique, 1)) * 100)}% of visitors`}
          icon={<User className="size-4" />}
        />
        <StatCard
          label="Anonymous visitors"
          value={anonymous}
          hint={`${Math.round(((anonymous || 0) / Math.max(unique, 1)) * 100)}% of visitors`}
          icon={<Globe className="size-4" />}
        />
        <StatCard
          label="Visitors (last 24h)"
          value={last24h}
          icon={<TrendingUp className="size-4" />}
          tone="info"
        />
      </div>

      {/* Store views section */}
      <div className="grid gap-4 xl:grid-cols-4">
        <StatCard
          label="Total store views"
          value={totalStoreViews}
          icon={<Store className="size-4" />}
          tone="neutral"
        />
        <StatCard
          label="Stores with views"
          value={storesViewed}
          hint={`of ${totalStoreCount} total`}
          icon={<Store className="size-4" />}
        />
        <StatCard
          label="Avg views per store"
          value={
            totalStoreCount
              ? Math.round((totalStoreViews / totalStoreCount) * 10) / 10
              : 0
          }
          icon={<Activity className="size-4" />}
        />
        <StatCard
          label="Unique visitors"
          value={unique}
          hint={`${total} total page views`}
          icon={<Users className="size-4" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card card-pad xl:col-span-2">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-semibold text-ink-900">Visits over time</h3>
            <p className="text-xs text-ink-400">Last 14 days</p>
          </div>
          <div className="h-32 w-full flex items-end gap-1 px-2 border-b border-ink-100 pb-2">
            {days.map((day) => {
              const height = Math.max(4, Math.round((day.visits / maxVisits) * 140));
              return (
                <div
                  key={day.day}
                  className="flex flex-col items-center gap-1"
                  style={{ flex: 1 }}
                >
                  <div
                    className="w-full bg-brand-600 rounded-t-sm"
                    style={{ height: `${height}px` }}
                  />
                  <span className="text-[10px] text-ink-400">
                    {new Date(day.day).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <span className="text-[10px] font-semibold text-ink-900">
                    {day.visits}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card card-pad">
          <h3 className="text-sm font-semibold text-ink-900 mb-3">
            Traffic by device
          </h3>
          {total === 0 ? (
            <EmptyState
              title="No visits yet"
              description="Visitor traffic appears here once shoppers browse the platform."
              icon={<Monitor className="size-5" />}
            />
          ) : (
            <div className="space-y-3">
              {["Desktop", "Mobile", "Tablet"].map((label) => {
                const count = recentVisits.filter(
                  (r) => deviceName(r.user_agent) === label,
                ).length;
                const pct = total ? Math.round((count / total) * 100) : 0;
                return (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-3"
                  >
                    <p className="text-sm text-ink-700">{label}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-ink-600">
                        {pct}%
                      </span>
                      <span className="text-xs text-ink-400">
                        {count} visit{count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card card-pad xl:col-span-2">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-semibold text-ink-900">Top pages</h3>
            <p className="text-xs text-ink-400">Most viewed paths</p>
          </div>
          {topPages.length === 0 ? (
            <EmptyState
              title="No pages visited yet"
              icon={<Globe className="size-5" />}
            />
          ) : (
            <div className="divide-y divide-ink-100">
              {topPages.map((page, index) => (
                <div
                  key={page.path}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <span
                      className={`text-[11px] font-bold rounded-full border px-2 py-0.5 ${
                        index < 3
                          ? "bg-brand-100 text-brand-700 border-brand-200"
                          : "bg-ink-50 text-ink-400 border-ink-100"
                      }`}
                    >
                      #{index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-800 truncate">
                        {page.path}
                      </p>
                      <p className="text-[11px] text-ink-500">
                        {page.views} view{page.views !== 1 ? "s" : ""} ·{" "}
                        {page.visitors} visitor{page.visitors !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <span className="text-right tabular-nums font-semibold text-ink-900">
                    {page.views}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card card-pad xl:col-span-2">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-semibold text-ink-900">
              Top stores by views
            </h3>
            <p className="text-xs text-ink-400">Most viewed storefronts</p>
          </div>
          {topStores.length === 0 ? (
            <EmptyState
              title="No store views yet"
              description="Store views appear here once shoppers visit vendor storefronts."
              icon={<Store className="size-5" />}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-ink-100">
                    <th className="pb-3 px-4 text-left text-xs font-semibold text-ink-400">
                      Store
                    </th>
                    <th className="pb-3 px-4 text-left text-xs font-semibold text-ink-400">
                      Owner
                    </th>
                    <th className="pb-3 px-4 text-right text-xs font-semibold text-ink-400">
                      Views
                    </th>
                    <th className="pb-3 px-4 text-right text-xs font-semibold text-ink-400">
                      Unique visitors
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {topStores.map((store) => (
                    <tr key={store.id} className="hover:bg-ink-50/50">
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <p className="font-medium text-ink-800 truncate max-w-[140px]">
                            {store.name}
                          </p>
                          <p className="text-[11px] text-ink-500 truncate max-w-[140px]">
                            /s/{store.slug}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <p className="font-medium text-ink-800 truncate max-w-[140px]">
                            {store.owner_name}
                          </p>
                          <p className="text-[11px] text-ink-500 truncate max-w-[140px]">
                            {store.owner_email}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-ink-900">
                        {store.views}
                      </td>
                      <td className="px-4 py-3 text-right text-ink-600">
                        {store.unique_visitors}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card card-pad xl:col-span-2">
          <h3 className="text-sm font-semibold text-ink-900 mb-3">
            Recent visits
          </h3>
          {recentVisits.length === 0 ? (
            <EmptyState title="No recent visits" icon={<Clock className="size-5" />} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-ink-100">
                    <th className="pb-3 px-4 text-left text-xs font-semibold text-ink-400">
                      When
                    </th>
                    <th className="pb-3 px-4 text-left text-xs font-semibold text-ink-400">
                      Page
                    </th>
                    <th className="pb-3 px-4 text-left text-xs font-semibold text-ink-400">
                      Device
                    </th>
                    <th className="pb-3 px-4 text-left text-xs font-semibold text-ink-400">
                      Referrer
                    </th>
                    <th className="pb-3 px-4 text-left text-xs font-semibold text-ink-400">
                      IP
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {recentVisits.map((visit) => (
                    <tr key={visit.id} className="hover:bg-ink-50/50">
                      <td className="px-4 py-3 text-ink-600">
                        <time>{formatDateTime(visit.created_at)}</time>
                        <p className="text-[11px] text-ink-400">
                          {timeAgo(visit.created_at)} ago
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink-800 truncate max-w-[160px]">
                          {visit.path}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-ink-600">
                        {deviceName(visit.user_agent)}
                      </td>
                      <td className="px-4 py-3 text-ink-600 truncate max-w-[140px]">
                        {visit.referrer ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-[11px] font-mono text-ink-400">
                        {visit.ip ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
