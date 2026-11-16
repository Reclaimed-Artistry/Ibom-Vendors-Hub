import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bell, CalendarClock, FileText, Package, Star, Store, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { formatMoney, formatDate, timeAgo } from "@/lib/utils";
import { ButtonLink, Card, CardHeader, EmptyState, PageHeader, StatCard, StatusBadge } from "@/components/ui";

export const metadata: Metadata = { title: "Account overview · Ibom Vendors Hub" };

export default async function AccountOverviewPage() {
  const user = await requireUser(["customer", "vendor", "admin", "super_admin"]);
  const [stats, orders, bookings, notifications] = await Promise.all([
    systemDb.maybeOne<{ orders: number; spend: number; reviews: number; quotes: number }>(
      `select
         (select count(*)::int from orders where lower(customer_email) = lower($1)) as orders,
         (select coalesce(sum(total),0)::numeric from orders where lower(customer_email) = lower($1) and payment_status = 'paid') as spend,
         (select count(*)::int from reviews where lower(customer_email) = lower($1)) as reviews,
         (select count(*)::int from service_quotations where lower(customer_email) = lower($1) and status in ('requested','quoted')) as quotes`,
      [user.email],
    ),
    systemDb.query<{ id: string; reference: string; status: string; total: number; created_at: string; store_name: string; item_count: number }>(
      `select o.id, o.reference, o.status, o.total, o.created_at, s.name as store_name,
              (select count(*)::int from order_items i where i.order_id = o.id) as item_count
         from orders o join stores s on s.id = o.store_id
        where lower(o.customer_email) = lower($1)
        order by o.created_at desc limit 4`,
      [user.email],
    ),
    systemDb.query<{ id: string; scheduled_date: string; scheduled_time: string; status: string; store_name: string }>(
      `select b.id, b.scheduled_date, b.scheduled_time, b.status, s.name as store_name
         from service_bookings b join stores s on s.id = b.store_id
        where lower(b.customer_email) = lower($1) and b.status in ('requested','confirmed','rescheduled')
          and b.scheduled_date >= current_date
        order by b.scheduled_date limit 3`,
      [user.email],
    ),
    systemDb.query<{ id: string; title: string; body: string | null; created_at: string; action_url: string | null }>(
      `select id, title, body, created_at, action_url from notifications
        where user_id = $1 order by created_at desc limit 4`,
      [user.id],
    ),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Hello, ${user.fullName.split(" ")[0]}`}
        description="Track your orders, quotations, bookings and reviews in one place."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {user.role === "customer" ? (
              <ButtonLink href="/register">
                <Store className="size-4" /> Create a storefront
              </ButtonLink>
            ) : null}
            <ButtonLink href="/browse" variant={user.role === "customer" ? "secondary" : "primary"}>
              Browse marketplace
            </ButtonLink>
          </div>
        }
      />

      {user.role === "customer" ? (
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 via-white to-emerald-50/70 p-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-700 text-white">
              <Store className="size-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-ink-900">Own a business in Akwa Ibom State?</p>
              <p className="mt-0.5 text-xs leading-5 text-ink-600">
                Because you&apos;re signed into your verified account, you can now create your storefront with a locked unique business name, custom subdomain, and direct Nigerian bank payouts.
              </p>
            </div>
          </div>
          <Link href="/register" className="btn-primary shrink-0 whitespace-nowrap">
            Create your storefront <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Orders" value={stats?.orders ?? 0} hint="All time" icon={<Package className="size-4" />} />
        <StatCard label="Total spent" value={formatMoney(Number(stats?.spend ?? 0))} hint="Paid orders" icon={<Wallet className="size-4" />} />
        <StatCard label="Open quotations" value={stats?.quotes ?? 0} hint="Awaiting your response" icon={<FileText className="size-4" />} />
        <StatCard label="Reviews written" value={stats?.reviews ?? 0} hint="Thank you for the feedback" icon={<Star className="size-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Recent orders" action={<Link href="/account/orders" className="text-sm font-semibold text-brand-700 hover:underline">All orders</Link>} />
          {orders.length === 0 ? (
            <EmptyState icon={<Package className="size-5" />} title="No orders yet" description="When you order from a storefront, it will appear here with live tracking." action={<ButtonLink href="/browse" size="sm" variant="secondary">Start shopping</ButtonLink>} />
          ) : (
            <ul className="divide-y divide-ink-100">
              {orders.map((order) => (
                <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <Link href={`/account/orders/${order.id}`} className="font-semibold text-ink-900 hover:text-brand-700">{order.reference}</Link>
                    <p className="text-xs text-ink-500">{order.store_name} · {order.item_count} item{order.item_count === 1 ? "" : "s"} · {formatDate(order.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={order.status} />
                    <span className="text-sm font-semibold">{formatMoney(Number(order.total))}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Upcoming bookings" action={<Link href="/account/bookings" className="text-xs font-semibold text-brand-700 hover:underline">All</Link>} />
            <div className="card-pad pt-0">
              {bookings.length === 0 ? (
                <p className="text-sm text-ink-500">No upcoming appointments.</p>
              ) : (
                <ul className="space-y-3">
                  {bookings.map((booking) => (
                    <li key={booking.id} className="flex items-start gap-2 text-sm">
                      <CalendarClock className="mt-0.5 size-4 shrink-0 text-brand-600" />
                      <div>
                        <p className="font-medium text-ink-900">{booking.store_name}</p>
                        <p className="text-xs text-ink-500">{formatDate(booking.scheduled_date)} at {booking.scheduled_time}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Notifications" action={<Link href="/account/notifications" className="text-xs font-semibold text-brand-700 hover:underline">All</Link>} />
            <div className="card-pad pt-0">
              {notifications.length === 0 ? (
                <p className="text-sm text-ink-500">Nothing yet.</p>
              ) : (
                <ul className="space-y-2.5">
                  {notifications.map((item) => (
                    <li key={item.id} className="text-sm">
                      <p className="flex items-start gap-1.5 font-medium text-ink-900"><Bell className="mt-0.5 size-3.5 shrink-0 text-ink-400" /> {item.title}</p>
                      <p className="text-xs text-ink-400">{timeAgo(item.created_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
