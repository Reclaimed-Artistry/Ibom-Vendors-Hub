import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  CalendarClock,
  ClipboardList,
  MessageSquare,
  Package,
  ShoppingBag,
  Star,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { requireActiveVendorContext } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { getStoreSubscription } from "@/lib/subscriptions";
import { formatMoney, formatDateTime, timeAgo } from "@/lib/utils";
import { Alert, ButtonLink, Card, CardHeader, EmptyState, PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { SubscriptionCountdown } from "@/components/subscription-countdown";

export const metadata: Metadata = { title: "Vendor overview · Ibom Vendors Hub" };

export default async function VendorOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; verifyUrl?: string }>;
}) {
  const { store, effectiveExpiresAt, effectiveStartedAt } = await requireActiveVendorContext();
  const { welcome, verifyUrl } = await searchParams;
  const subscription = await getStoreSubscription(store.id);

  const [stats, recentOrders, recentReviews, lowStock, upcoming, messages] = await Promise.all([
    systemDb.maybeOne<{
      paid_orders: number;
      revenue: number;
      pending_orders: number;
      products: number;
      unavailable: number;
      rating: number;
      reviews: number;
      customers: number;
    }>(
      `select
         (select count(*)::int from orders where store_id = $1 and payment_status = 'paid') as paid_orders,
         (select coalesce(sum(total),0)::numeric from orders where store_id = $1 and payment_status = 'paid' and status not in ('refunded','cancelled')) as revenue,
         (select count(*)::int from orders where store_id = $1 and status in ('pending','accepted','preparing','production','ready')) as pending_orders,
         (select count(*)::int from products where store_id = $1) as products,
         (select count(*)::int from products where store_id = $1 and not is_available) as unavailable,
         (select coalesce(avg(rating),0)::numeric from reviews where store_id = $1 and status = 'published') as rating,
         (select count(*)::int from reviews where store_id = $1 and status = 'published') as reviews,
         (select count(distinct customer_email)::int from orders where store_id = $1) as customers`,
      [store.id],
    ),
    systemDb.query<{ id: string; reference: string; customer_name: string; total: number; status: string; payment_status: string; created_at: string }>(
      `select id, reference, customer_name, total, status, payment_status, created_at
         from orders where store_id = $1 order by created_at desc limit 6`,
      [store.id],
    ),
    systemDb.query<{ id: string; rating: number; title: string | null; body: string; customer_name: string; created_at: string }>(
      `select r.id, r.rating, r.title, r.comment as body, coalesce(r.customer_name, u.full_name, 'Customer') as customer_name, r.created_at
         from reviews r left join users u on u.id = r.customer_id
        where r.store_id = $1 and r.status = 'published' order by r.created_at desc limit 3`,
      [store.id],
    ),
    systemDb.query<{ id: string; name: string; stock_quantity: number; track_stock: boolean }>(
      `select id, name, stock_quantity, track_stock from products
        where store_id = $1 and track_stock and stock_quantity <= 5 order by stock_quantity limit 5`,
      [store.id],
    ),
    systemDb.query<{ id: string; customer_name: string; scheduled_date: string; scheduled_time: string; status: string }>(
      `select id, customer_name, scheduled_date, scheduled_time, status from service_bookings
        where store_id = $1 and status in ('pending','confirmed') and scheduled_date >= current_date
        order by scheduled_date, scheduled_time limit 4`,
      [store.id],
    ),
    systemDb.query<{ id: string; subject: string; sender_name: string; created_at: string; status: string }>(
      `select id, subject, sender_name, created_at, status from customer_messages
        where store_id = $1 and sender_role <> 'vendor' order by created_at desc limit 4`,
      [store.id],
    ),
  ]);

  const currency = "NGN";

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Welcome back${welcome ? "" : ""}`}
        description={`Here is how ${store.name} is performing today.`}
        actions={
          <>
            <ButtonLink href="/vendor/products/new" variant="secondary">Add product</ButtonLink>
            <ButtonLink href="/vendor/orders">View orders</ButtonLink>
          </>
        }
      />

      {welcome ? (
        <Alert tone="success" title="Your vendor account is ready">
          Your 14-day trial has started. Add your first products so customers can find you as soon as an admin approves your storefront.
        </Alert>
      ) : null}

      {verifyUrl ? (
        <Alert tone="info" title="Confirm your email address">
          <p>We sent you a verification link. For local development you can also use this one:</p>
          <Link href={verifyUrl} className="mt-1 inline-block break-all font-semibold text-brand-700 underline">
            {verifyUrl}
          </Link>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Paid revenue" value={formatMoney(Number(stats?.revenue ?? 0), currency)} hint={`${stats?.paid_orders ?? 0} paid orders`} icon={<Wallet className="size-4" />} />
        <StatCard label="Open orders" value={stats?.pending_orders ?? 0} hint="Awaiting acceptance or fulfilment" icon={<ShoppingBag className="size-4" />} />
        <StatCard label="Products" value={stats?.products ?? 0} hint={`${stats?.unavailable ?? 0} marked unavailable`} icon={<Package className="size-4" />} />
        <StatCard label="Customer rating" value={(Number(stats?.rating ?? 0)).toFixed(1)} hint={`${stats?.reviews ?? 0} published reviews`} icon={<Star className="size-4" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Recent orders"
            description="Accept orders quickly to keep your response score high."
            action={<Link href="/vendor/orders" className="text-sm font-semibold text-brand-700 hover:underline">All orders</Link>}
          />
          {recentOrders.length === 0 ? (
            <EmptyState icon={<ShoppingBag className="size-5" />} title="No orders yet" description="Share your storefront link to get your first order." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th className="text-right">Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link href={`/vendor/orders/${order.id}`} className="font-semibold text-ink-900 hover:text-brand-700">{order.reference}</Link>
                        <p className="text-xs text-ink-400">{formatDateTime(order.created_at)}</p>
                      </td>
                      <td className="text-sm">{order.customer_name}</td>
                      <td><StatusBadge status={order.status} /></td>
                      <td className="text-right font-semibold">{formatMoney(Number(order.total), currency)}</td>
                      <td className="text-right"><Link href={`/vendor/orders/${order.id}`} className="text-brand-700"><ArrowRight className="size-4" /></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <div className="space-y-2.5">
            <SubscriptionCountdown
              variant="hero"
              expiresAt={subscription?.expires_at ?? effectiveExpiresAt}
              startedAt={subscription?.started_at ?? effectiveStartedAt}
              planName={subscription?.plan.name ?? (effectiveExpiresAt ? "Admin access grant" : "No plan")}
              status={subscription?.status ?? null}
            />
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/vendor/subscription" size="sm" variant="secondary">Manage / extend plan</ButtonLink>
              <Link href="/vendor/store" className="btn btn-ghost btn-sm">Edit storefront</Link>
            </div>
          </div>

          <Card>
            <CardHeader title="Upcoming bookings" action={<Link href="/vendor/bookings" className="text-xs font-semibold text-brand-700 hover:underline">All</Link>} />
            <div className="card-pad pt-0">
              {upcoming.length === 0 ? (
                <p className="text-sm text-ink-500">Nothing scheduled. Bookings will appear here once customers request a session.</p>
              ) : (
                <ul className="space-y-3">
                  {upcoming.map((booking) => (
                    <li key={booking.id} className="flex items-start gap-2 text-sm">
                      <CalendarClock className="mt-0.5 size-4 shrink-0 text-brand-600" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink-900">{booking.customer_name}</p>
                        <p className="text-xs text-ink-500">{formatDateTime(`${booking.scheduled_date}T${booking.scheduled_time}Z`)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Low stock" action={<Link href="/vendor/products" className="text-xs font-semibold text-brand-700 hover:underline">Manage</Link>} />
          <div className="card-pad pt-0">
            {lowStock.length === 0 ? (
              <p className="text-sm text-ink-500">All tracked products are comfortably stocked.</p>
            ) : (
              <ul className="space-y-2.5">
                {lowStock.map((product) => (
                  <li key={product.id} className="flex items-center justify-between gap-3 text-sm">
                    <Link href={`/vendor/products/${product.id}`} className="truncate hover:text-brand-700">{product.name}</Link>
                    <span className={`badge ${product.stock_quantity === 0 ? "badge-danger" : "badge-warning"}`}>{product.stock_quantity} left</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Latest reviews" action={<Link href="/vendor/reviews" className="text-xs font-semibold text-brand-700 hover:underline">All</Link>} />
          <div className="card-pad pt-0">
            {recentReviews.length === 0 ? (
              <p className="text-sm text-ink-500">No reviews yet.</p>
            ) : (
              <ul className="space-y-3">
                {recentReviews.map((review) => (
                  <li key={review.id}>
                    <div className="flex items-center gap-1 text-amber-500">
                      {Array.from({ length: review.rating }).map((_, index) => <Star key={index} className="size-3.5 fill-current" />)}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-ink-700">{review.body}</p>
                    <p className="text-xs text-ink-400">{review.customer_name} · {timeAgo(review.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Customer messages" action={<Link href="/vendor/messages" className="text-xs font-semibold text-brand-700 hover:underline">Inbox</Link>} />
          <div className="card-pad pt-0">
            {messages.length === 0 ? (
              <p className="text-sm text-ink-500">No messages yet.</p>
            ) : (
              <ul className="space-y-3">
                {messages.map((message) => (
                  <li key={message.id} className="text-sm">
                    <p className="truncate font-medium text-ink-900">{message.subject}</p>
                    <p className="text-xs text-ink-500">{message.sender_name} · {timeAgo(message.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <Card className="card-pad">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-ink-600">
            <BadgeCheck className="size-4 text-brand-600" />
            <span>{stats?.customers ?? 0} customers · {stats?.products ?? 0} products · {stats?.reviews ?? 0} reviews</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/vendor/customers" className="btn btn-ghost btn-sm"><TrendingUp className="size-3.5" /> Customers</Link>
            <Link href="/vendor/quotations" className="btn btn-ghost btn-sm"><ClipboardList className="size-3.5" /> Quotations</Link>
            <Link href="/vendor/messages" className="btn btn-ghost btn-sm"><MessageSquare className="size-3.5" /> Messages</Link>
            <Link href="/vendor/categories" className="btn btn-ghost btn-sm"><Boxes className="size-3.5" /> Categories</Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
