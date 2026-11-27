"use client";

import { useState } from "react";
import { usePoll } from "@/lib/use-poll";
import { PageHeader, StatCard } from "@/components/ui";
import { Monitor, Users, Globe, Store, Clock, TrendingUp } from "lucide-react";

interface PollAnalytics {
  totalVisits: number;
  uniqueVisitors: number;
  visitorsLast24h: number;
  totalStoreViews: number;
  storesWithViews: number;
  totalStores: number;
  topStores: Array<{
    id: string;
    name: string;
    slug: string;
    views: number;
    unique_visitors: number;
    owner_name: string;
    owner_email: string;
  }>;
  topPages: Array<{ path: string; views: number; visitors: number }>;
  recentVisits: Array<{
    id: string;
    session_id: string;
    path: string;
    referrer: string | null;
    user_agent: string | null;
    ip: string | null;
    created_at: string;
  }>;
  updatedAt: string;
}

interface RealtimeAnalyticsProps {
  initialData: PollAnalytics;
}

export function RealtimeAnalytics({ initialData }: RealtimeAnalyticsProps) {
  const [data, setData] = useState<PollAnalytics>(initialData);

  const { data: polledData, error } = usePoll<PollAnalytics>(
    async () => {
      const res = await fetch("/api/poll/analytics", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
    500,
    initialData
  );

  if (polledData) {
    setData(polledData);
  }

  const {
    totalVisits,
    uniqueVisitors,
    visitorsLast24h,
    totalStoreViews,
    storesWithViews,
    totalStores,
    topStores,
    topPages,
    recentVisits,
  } = data;

  const topPath = topPages[0]?.path ?? "—";
  const topViews = topPages[0]?.views ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Visitor analytics"
        description={`Track site visitors, store views, and product views across the platform. (Live updates every 0.5s)`}
        actions={null}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total site visitors"
          value={totalVisits}
          icon={<Monitor className="size-4" />}
          tone="neutral"
        />
        <StatCard
          label="Logged-in visitors"
          value={uniqueVisitors}
          icon={<Users className="size-4" />}
          tone="info"
        />
        <StatCard
          label="Visitors last 24h"
          value={visitorsLast24h}
          icon={<Clock className="size-4" />}
          tone="neutral"
        />
        <StatCard
          label="Total stores"
          value={totalStores}
          icon={<Store className="size-4" />}
          tone="neutral"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total store views"
          value={totalStoreViews}
          icon={<Monitor className="size-4" />}
          tone="neutral"
        />
        <StatCard
          label="Stores with views"
          value={storesWithViews}
          icon={<Users className="size-4" />}
          tone="info"
        />
        <StatCard
          label="Top page"
          value={topViews}
          icon={<Globe className="size-4" />}
          tone="neutral"
        />
        <StatCard
          label="Top path"
          value={topPath}
          icon={<TrendingUp className="size-4" />}
          tone="neutral"
        />
      </div>

      <div className="xl:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-400">
            Top storefronts by views
          </h3>
        </div>
        <div className="rounded-xl border border-ink-100 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm min-w-[600px]">
              <thead>
                <tr className="bg-ink-50 border-b border-ink-100">
                  <th className="pb-3 px-4 text-left text-xs font-semibold text-ink-400 uppercase tracking-wider">
                    #
                  </th>
                  <th className="pb-3 px-4 text-left text-xs font-semibold text-ink-400 uppercase tracking-wider">
                    Store
                  </th>
                  <th className="pb-3 px-4 text-left text-xs font-semibold text-ink-400 uppercase tracking-wider">
                    Owner
                  </th>
                  <th className="pb-3 px-4 text-right text-xs font-semibold text-ink-400 uppercase tracking-wider">
                    Views
                  </th>
                  <th className="pb-3 px-4 text-right text-xs font-semibold text-ink-400 uppercase tracking-wider">
                    Unique visitors
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {topStores.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-ink-500">
                      No store views yet.
                    </td>
                  </tr>
                ) : (
                  topStores.map((store, index) => (
                    <tr key={store.id} className="hover:bg-ink-50/50">
                      <td className="px-4 py-3 text-right text-[11px] font-medium text-ink-400">
                        {index + 1}
                      </td>
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
                      <td className={`px-4 py-3 text-right tabular-nums font-semibold ${store.views === 0 ? "text-ink-400" : "text-ink-900"}`}>
                        {store.views}
                      </td>
                      <td className="px-4 py-3 text-right text-ink-600">
                        {store.unique_visitors}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="xl:col-span-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-400 mb-3">
          Recent visits
        </h3>
        {recentVisits.length === 0 ? (
          <div className="rounded-xl border border-ink-100 bg-white p-6 text-center text-ink-500 text-sm">
            No recent visits.
          </div>
        ) : (
          <div className="rounded-xl border border-ink-100 bg-white shadow-sm overflow-hidden">
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
                      <td className="px-4 py-3 text-[11px] text-ink-500">
                        {new Date(visit.created_at).toLocaleString("en-NG", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-ink-600 truncate max-w-[200px]">
                        {visit.path}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-ink-600">
                        {/mobile|android|iphone|ipod/.test((visit.user_agent ?? "").toLowerCase())
                          ? "Mobile"
                          : /ipad|tablet/.test((visit.user_agent ?? "").toLowerCase())
                            ? "Tablet"
                            : "Desktop"}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-ink-600 truncate max-w-[120px]">
                        {visit.referrer ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-ink-600 font-mono">
                        {visit.ip ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Failed to fetch live updates: {error.message}
        </div>
      )}
    </div>
  );
}
