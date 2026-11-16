import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Building2, CalendarClock, CreditCard, Flag, ShoppingBag, Users, Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatMoney, formatDate, timeAgo } from "@/lib/utils";
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { googleSignInStatus } from "@/lib/google-auth";
import { ReviewCountdown } from "@/components/review-countdown";

export const metadata: Metadata = { title: "Admin overview · Ibom Vendors Hub" };

export default async function AdminOverviewPage() {
  await requireAdmin();
  const settings = await getSettings();
  const google = await googleSignInStatus();

  const [stats, pendingStores, recentVendors, payments, activity] = await Promise.all([
    systemDb.maybeOne<{
      stores: number;
      active: number;
      pending: number;
      suspended: number;
      expired: number;
      customers: number;
      orders: number;
      gmv: number;
      commission: number;
      mrr: number;
      open_refunds: number;
    }>(
      `select
         (select count(*)::int from stores) as stores,
         (select count(*)::int from stores where status = 'active') as active,
         (select count(*)::int from stores where status = 'pending') as pending,
         (select count(*)::int from stores where status = 'suspended') as suspended,
         (select count(*)::int from stores where status = 'expired') as expired,
         (select count(*)::int from users where role = 'customer') as customers,
         (select count(*)::int from orders) as orders,
         (select coalesce(sum(total),0)::numeric from orders where payment_status = 'paid') as gmv,
         (select coalesce(sum(platform_commission),0)::numeric from orders where payment_status = 'paid') as commission,
         (select coalesce(sum(p.amount),0)::numeric from payments p where p.scope = 'subscription' and p.status = 'success' and p.paid_at > now() - interval '30 days') as mrr,
         (select count(*)::int from refunds where status = 'requested') as open_refunds`,
    ),
    systemDb.query<{ id: string; name: string; slug: string; owner_name: string; owner_email: string; category_name: string | null; created_at: string; review_deadline_at: string | null }>(
      `select s.id, s.name, s.slug, u.full_name as owner_name, u.email as owner_email, c.name as category_name, s.created_at, s.review_deadline_at
         from stores s join users u on u.id = s.owner_id left join store_categories c on c.id = s.category_id
        where s.status = 'pending' order by s.created_at limit 6`,
    ),
    systemDb.query<{ id: string; name: string; slug: string; status: string; created_at: string; owner_email: string }>(
      `select s.id, s.name, s.slug, s.status, s.created_at, u.email as owner_email
         from stores s join users u on u.id = s.owner_id order by s.created_at desc limit 5`,
    ),
    systemDb.query<{ reference: string; amount: number; scope: string; status: string; created_at: string; payer_email: string }>(
      `select reference, amount, scope, status, created_at, payer_email from payments order by created_at desc limit 6`,
    ),
    systemDb.query<{ id: string; action: string; description: string | null; actor_role: string; created_at: string }>(
      `select id, action, description, actor_role, created_at from activity_logs order by created_at desc limit 8`,
    ),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Platform overview"
        description={`Commission ${settings.commission_rate}% · trial ${settings.default_trial_days} days · ${settings.sandbox_payments ? "sandbox payments" : "live payments"}`}
      />


      {google.live ? null : (
        <Card className="border-amber-200 bg-amber-50/60">
          <div className="flex flex-wrap items-start justify-between gap-3 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" />
              <div>
                <p className="text-sm font-semibold text-ink-900">Google sign-in is not live yet</p>
                <p className="mt-1 max-w-2xl text-sm text-ink-600">
                  {google.enabled
                    ? "Customers currently have to choose a password. Paste your Google OAuth client ID (and secret) once and the “Continue with Google” button appears on sign-in and sign-up — no redeploy needed."
                    : "The switch is off, so nobody can use Google to sign in. Turn it back on in Platform settings once the credentials are in place."}
                </p>
                <p className="mt-2 text-xs text-ink-500">
                  Redirect URI to whitelist in Google Cloud Console:{" "}
                  <code className="rounded bg-white px-1.5 py-0.5 text-[11px] text-ink-700">{google.redirectUri}</code>
                </p>
              </div>
            </div>
            <Link href="/admin/settings" className="btn-primary shrink-0">
              Finish setup <ArrowRight className="size-4" />
            </Link>
          </div>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Vendors" value={stats?.stores ?? 0} hint={`${stats?.active ?? 0} active · ${stats?.pending ?? 0} pending`} icon={<Building2 className="size-4" />} />
        <StatCard label="Gross merchandise value" value={formatMoney(Number(stats?.gmv ?? 0))} hint={`${stats?.orders ?? 0} orders`} icon={<ShoppingBag className="size-4" />} />
        <StatCard label="Platform commission" value={formatMoney(Number(stats?.commission ?? 0))} hint="5% of paid orders" icon={<Wallet className="size-4" />} />
        <StatCard label="Subscription revenue" value={formatMoney(Number(stats?.mrr ?? 0))} hint="Last 30 days" icon={<CreditCard className="size-4" />} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Customers" value={stats?.customers ?? 0} icon={<Users className="size-4" />} />
        <StatCard label="Expired stores" value={stats?.expired ?? 0} hint="Data retained" icon={<AlertTriangle className="size-4" />} />
        <StatCard label="Suspended" value={stats?.suspended ?? 0} icon={<Flag className="size-4" />} />
        <StatCard label="Open refund requests" value={stats?.open_refunds ?? 0} icon={<CalendarClock className="size-4" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Awaiting 48-hour document review"
            description="Review uploaded Proof of Residence, NIN & registration documents before approving or declining."
            action={<Link href="/admin/messages?status=store_approval" className="text-sm font-semibold text-brand-700 hover:underline">Open review inbox</Link>}
          />
          {pendingStores.length === 0 ? (
            <EmptyState icon={<Building2 className="size-5" />} title="Nothing waiting" description="Every application has been reviewed." />
          ) : (
            <ul className="divide-y divide-ink-100">
              {pendingStores.map((store) => (
                <li key={store.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <Link href={`/admin/vendors/${store.id}`} className="font-semibold text-ink-900 hover:text-brand-700">{store.name}</Link>
                    <p className="text-xs text-ink-500">{store.owner_name} · {store.owner_email} · {timeAgo(store.created_at)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ReviewCountdown deadlineAt={store.review_deadline_at} createdAt={store.created_at} compact />
                    <Badge tone="warning">{store.category_name ?? "Uncategorised"}</Badge>
                    <Link href={`/admin/vendors/${store.id}`} className="btn-primary btn-sm">
                      Review documents &amp; decide
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Latest payments" action={<Link href="/admin/payments" className="text-xs font-semibold text-brand-700 hover:underline">All</Link>} />
          <div className="card-pad pt-0">
            {payments.length === 0 ? (
              <p className="text-sm text-ink-500">No payments yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {payments.map((payment) => (
                  <li key={payment.reference} className="flex items-start justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-ink-800">{payment.reference}</p>
                      <p className="text-xs text-ink-400">{payment.scope} · {formatDate(payment.created_at)}</p>
                    </div>
                    <Badge tone={payment.status === "success" ? "success" : payment.status === "failed" ? "danger" : "warning"}>{formatMoney(Number(payment.amount))}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Newest storefronts" action={<Link href="/admin/vendors" className="text-xs font-semibold text-brand-700 hover:underline">Manage vendors</Link>} />
          <ul className="divide-y divide-ink-100">
            {recentVendors.map((store) => (
              <li key={store.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <div className="min-w-0">
                  <Link href={`/admin/vendors/${store.id}`} className="truncate font-medium text-ink-800 hover:text-brand-700">{store.name}</Link>
                  <p className="text-xs text-ink-400">{store.owner_email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={store.status === "active" ? "success" : store.status === "pending" ? "warning" : "danger"}>{store.status}</Badge>
                  <Link href={`/admin/vendors/${store.id}`} className="text-brand-700"><ArrowRight className="size-4" /></Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Recent activity" action={<Link href="/admin/audit" className="text-xs font-semibold text-brand-700 hover:underline">Audit log</Link>} />
          <ul className="divide-y divide-ink-100">
            {activity.map((entry) => (
              <li key={entry.id} className="px-5 py-2.5 text-sm">
                <p className="font-medium text-ink-800">{entry.action.replace(/\./g, " · ")}</p>
                <p className="text-xs text-ink-400">{entry.description ?? entry.actor_role} · {timeAgo(entry.created_at)}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
