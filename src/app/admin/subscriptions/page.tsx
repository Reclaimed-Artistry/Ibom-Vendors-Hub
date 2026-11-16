import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { getPlans } from "@/lib/subscriptions";
import { formatMoney, formatDate } from "@/lib/utils";
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { PlanForm } from "@/components/admin-forms";

export const metadata: Metadata = { title: "Subscriptions · Admin" };

export default async function AdminSubscriptionsPage() {
  await requireAdmin();
  const [plans, stores, stats] = await Promise.all([
    getPlans(true),
    systemDb.query<{
      store_id: string;
      store_name: string;
      slug: string;
      plan_name: string;
      status: string;
      expires_at: string;
      price: number;
    }>(
      `select s.id as store_id, s.name as store_name, s.slug, p.name as plan_name, sub.status, sub.expires_at, p.price
         from subscriptions sub
         join stores s on s.id = sub.store_id
         join subscription_plans p on p.id = sub.plan_id
        where sub.status in ('trialing','active')
        order by sub.expires_at limit 100`,
    ),
    systemDb.maybeOne<{ trialing: number; active: number; expiring: number; collected: number }>(
      `select
         (select count(*)::int from subscriptions where status = 'trialing') as trialing,
         (select count(*)::int from subscriptions where status = 'active') as active,
         (select count(*)::int from subscriptions where status = 'active' and expires_at <= now() + interval '7 days') as expiring,
         (select coalesce(sum(amount),0)::numeric from payments where scope = 'subscription' and status = 'success' and paid_at > now() - interval '30 days') as collected`,
    ),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader title="Subscriptions" description="Plans, active subscriptions and renewal exposure." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Trialing" value={stats?.trialing ?? 0} hint="14-day trials" />
        <StatCard label="Active" value={stats?.active ?? 0} hint="Paying stores" />
        <StatCard label="Expiring soon" value={stats?.expiring ?? 0} hint="Within 7 days" />
        <StatCard label="Collected (30d)" value={formatMoney(Number(stats?.collected ?? 0))} icon={<CreditCard className="size-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Active & trialing subscriptions" action={<Link href="/admin/vendors" className="text-sm font-semibold text-brand-700 hover:underline">Manage vendors</Link>} />
            {stores.length === 0 ? (
              <EmptyState icon={<CreditCard className="size-5" />} title="No active subscriptions" description="Vendors appear here once their trial starts." />
            ) : (
              <div className="table-wrap rounded-none border-0">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Store</th>
                      <th>Plan</th>
                      <th>Status</th>
                      <th className="text-right">Price</th>
                      <th>Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stores.map((row) => (
                      <tr key={row.store_id}>
                        <td>
                          <Link href={`/admin/vendors/${row.store_id}`} className="font-medium text-ink-900 hover:text-brand-700">{row.store_name}</Link>
                          <p className="text-xs text-ink-400">/s/{row.slug}</p>
                        </td>
                        <td className="text-sm">{row.plan_name}</td>
                        <td><Badge tone={row.status === "active" ? "success" : "info"}>{row.status}</Badge></td>
                        <td className="text-right">{formatMoney(Number(row.price))}</td>
                        <td className="text-xs text-ink-500">{formatDate(row.expires_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Plans" description="Pricing, limits and feature bullets." />
            <div className="divide-y divide-ink-100">
              {plans.map((plan) => (
                <details key={plan.id} className="px-5 py-3">
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-ink-900">{plan.name}</span>
                    <span className="flex items-center gap-2 text-sm">
                      <Badge tone={plan.is_active ? "success" : "neutral"}>{plan.is_active ? "active" : "hidden"}</Badge>
                      <span className="font-semibold">{formatMoney(Number(plan.price))}</span>
                      <span className="text-xs text-ink-400">{plan.product_limit ?? "∞"} products</span>
                    </span>
                  </summary>
                  <div className="mt-3">
                    <PlanForm
                      plan={{
                        id: plan.id,
                        name: plan.name,
                        price: Number(plan.price),
                        duration_days: plan.duration_days,
                        product_limit: plan.product_limit,
                        order_limit: plan.order_limit,
                        features: plan.features,
                        is_active: plan.is_active,
                        is_featured: plan.is_featured,
                      }}
                    />
                  </div>
                </details>
              ))}
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title="Create a plan" description="New plans appear on vendor billing pages immediately." />
          <div className="card-pad">
            <p className="mb-3 flex items-center gap-1.5 text-xs text-ink-400"><Plus className="size-3.5" /> New plan</p>
            <PlanForm />
          </div>
        </Card>
      </div>
    </div>
  );
}
