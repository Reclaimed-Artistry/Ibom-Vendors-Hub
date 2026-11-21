import { requireAdmin } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import {
  getSiteVisitorStats,
  getTopStoresByViews,
  getRecentStoreViews,
  getAllStoreViewStats,
} from "@/lib/visitor-tracking";
import {
  Badge,
  Card,
  CardHeader,
  PageHeader,
  StatCard,
} from "@/components/ui";
import {
  Users,
  Eye,
  Store,
  Clock,
  LayoutDashboard,
  Activity,
} from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Visitor analytics · Ibom Vendors Hub",
};

export default async function AnalyticsPage() {
  await requireAdmin();

  const [siteStats, topStores, recentViews, allStoreStats] = await Promise.all([
    getSiteVisitorStats(),
    getTopStoresByViews(10),
    getRecentStoreViews(20),
    getAllStoreViewStats(),
  ]);

  const totalStoreViews = allStoreStats.reduce(
    (sum, s) => sum + s.view_count,
    0,
  );
  const storesWithViews = allStoreStats.filter((s) => s.view_count > 0).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Visitor analytics"
        description="Track site visitors, store views, and product views across the platform."
      />

      {/* Site-wide stats */}
      <Card>
        <CardHeader
          title="Site-wide visitors"
          description="Every page load on the platform, split by logged-in vs anonymous."
        />
        <div className="card-pad pt-0">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total visitors"
              value={siteStats.total}
              icon={<Users className="size-4" />}
              tone="info"
            />
            <StatCard
              label="Logged-in visitors"
              value={siteStats.loggedIn}
              icon={<LayoutDashboard className="size-4" />}
              tone="success"
            />
            <StatCard
              label="Anonymous visitors"
              value={siteStats.anonymous}
              icon={<Eye className="size-4" />}
              tone="neutral"
            />
            <StatCard
              label="Visitors (last 24h)"
              value={siteStats.today}
              icon={<Clock className="size-4" />}
              tone="warning"
            />
          </div>
        </div>
      </Card>

      {/* Store view stats */}
      <Card>
        <CardHeader
          title="Store views"
          description={`Total views across all vendor storefronts. ${storesWithViews} of ${allStoreStats.length} stores have received at least one view.`}
        />
        <div className="card-pad pt-0">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total store views"
              value={totalStoreViews}
              icon={<Store className="size-4" />}
              tone="info"
            />
            <StatCard
              label="Stores with views"
              value={storesWithViews}
              hint={`of ${allStoreStats.length} total`}
              icon={<Activity className="size-4" />}
              tone="success"
            />
            <StatCard
              label="Avg views per store"
              value={
                allStoreStats.length
                  ? Math.round(totalStoreViews / allStoreStats.length)
                  : 0
              }
              icon={<Eye className="size-4" />}
              tone="neutral"
            />
          </div>
        </div>
      </Card>

      {/* Top stores by views */}
      <Card>
        <CardHeader
          title="Top stores by views"
          action={
            <Link
              href="/admin/vendors"
              className="text-xs font-semibold text-brand-700 hover:underline"
            >
              All vendors
            </Link>
          }
        />
        <div className="card-pad pt-0">
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Owner</th>
                  <th className="text-right">Views</th>
                  <th className="text-right">Unique IPs</th>
                </tr>
              </thead>
              <tbody>
                {topStores.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-ink-400">
                      No store views recorded yet.
                    </td>
                  </tr>
                ) : (
                  topStores.map((store) => (
                    <tr key={store.store_id}>
                      <td>
                        <Link
                          href={`/s/${store.store_slug}`}
                          target="_blank"
                          className="font-semibold text-ink-900 hover:text-brand-700"
                        >
                          {store.store_name}
                        </Link>
                        <p className="text-xs text-ink-400">
                          /s/{store.store_slug}
                        </p>
                      </td>
                      <td className="text-sm">{store.owner_email}</td>
                      <td className="text-right font-semibold">
                        {store.view_count}
                      </td>
                      <td className="text-right text-xs text-ink-400">
                        {store.unique_ips}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* All stores view stats */}
      <Card>
        <CardHeader
          title="All stores — view summary"
          description="Complete list of every store and its total view count."
        />
        <div className="card-pad pt-0">
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Owner</th>
                  <th className="text-right">Views</th>
                  <th className="text-right">Unique IPs</th>
                  <th className="text-right">Last viewed</th>
                </tr>
              </thead>
              <tbody>
                {allStoreStats.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-ink-400">
                      No stores found.
                    </td>
                  </tr>
                ) : (
                  allStoreStats.map((store) => (
                    <tr key={store.store_id}>
                      <td>
                        <Link
                          href={`/s/${store.store_slug}`}
                          target="_blank"
                          className="font-semibold text-ink-900 hover:text-brand-700"
                        >
                          {store.store_name}
                        </Link>
                        <p className="text-xs text-ink-400">
                          /s/{store.store_slug}
                        </p>
                      </td>
                      <td className="text-sm">{store.owner_email}</td>
                      <td className="text-right font-semibold">
                        {store.view_count}
                      </td>
                      <td className="text-right text-xs text-ink-400">
                        {store.unique_ips}
                      </td>
                      <td className="text-right text-xs text-ink-400">
                        {store.last_viewed ? new Date(store.last_viewed).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Recent visitor log */}
      <Card>
        <CardHeader title="Recent store visitor log" />
        <div className="card-pad pt-0">
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Visitor</th>
                  <th className="text-right">IP</th>
                  <th className="text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentViews.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-ink-400">
                      No recent store visits.
                    </td>
                  </tr>
                ) : (
                  recentViews.map((view) => (
                    <tr key={view.id}>
                      <td>
                        <Link
                          href={`/s/${view.store_id}`}
                          target="_blank"
                          className="font-semibold text-ink-900 hover:text-brand-700"
                        >
                          {view.store_name}
                        </Link>
                      </td>
                      <td className="text-sm">
                        {view.user_email ?? "Anonymous visitor"}
                        {view.user_role ? (
                          <span className="ml-1 text-xs text-ink-400">({view.user_role})</span>
                        ) : null}
                      </td>
                      <td className="text-right text-xs font-mono text-ink-400">
                        {view.ip}
                      </td>
                      <td className="text-right text-xs text-ink-400">
                        {new Date(view.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
