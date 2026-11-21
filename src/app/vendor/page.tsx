import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  CalendarClock,
  ClipboardList,
  Fuel,
  MessageSquare,
  Package,
  ShoppingBag,
  Star,
  Store,
  TrendingUp,
  Wallet,
  Eye,
  Percent,
  Clock,
  Clock as ClockIcon,
  Users,
} from "lucide-react";
import { requireActiveVendorContext } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { getStoreSubscription } from "@/lib/subscriptions";
import {
  getVendorStoreViewStats,
  getVendorProductViewStats,
} from "@/lib/visitor-tracking";
import { formatMoney, formatDateTime, timeAgo, formatNumber } from "@/lib/utils";
import {
  Alert,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  StatCard,
  StatusBadge,
} from "@/components/ui";
import { SubscriptionCountdown } from "@/components/subscription-countdown";

export const metadata: Metadata = { title: "Vendor overview · Ibom Vendors Hub" };

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  sales_count: number;
  views_count: number;
  price: number;
  is_available: boolean;
  image_url: string | null;
  rating_avg: number;
}

export default async function VendorOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; verifyUrl?: string }>;
}) {
  const { store, effectiveExpiresAt, effectiveStartedAt } = await requireActiveVendorContext();
  const { welcome, verifyUrl } = await searchParams;
  const subscription = await getStoreSubscription(store.id);

  const currency = "NGN";

  const [stats, recentOrders, recentReviews, lowStock, upcoming, messages, bestSellers, mostViewed] =
    await Promise.all([
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
      systemDb.query<ProductRow>(
        `select p.id, p.name, p.slug, p.sales_count, p.views_count, p.price, p.is_available,
                p.rating_avg,
                (select i.url from product_images i where i.product_id = p.id order by i.sort_order limit 1) as image_url
           from products p
          where p.store_id = $1
          order by p.sales_count desc, p.views_count desc
          limit 6`,
        [store.id],
      ),
      systemDb.query<ProductRow>(
        `select p.id, p.name, p.slug, p.sales_count, p.views_count, p.price, p.is_available,
                p.rating_avg,
                (select i.url from product_images i where i.product_id = p.id order by i.sort_order limit 1) as image_url
           from products p
          where p.store_id = $1
          order by p.views_count desc, p.sales_count desc
          limit 6`,
        [store.id],
      ),
    ]);

  const [storeViewStats, productViewStats] = await Promise.all([
    getVendorStoreViewStats(store.id),
    getVendorProductViewStats(store.id),
  ]);

  const paidOrders = stats?.paid_orders ?? 0;
  const totalProducts = stats?.products ?? 0;
  const revenue = Number(stats?.revenue ?? 0);
  const conversionRate = paidOrders > 0 && totalProducts > 0 ? Math.round((paidOrders / totalProducts) * 100) : 0;
  const averageOrderValue = paidOrders > 0 ? Math.round(revenue / paidOrders) : 0;

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
          Registering and owning your store is absolutely free. Add your first products so customers can find you as soon as an admin approves your storefront.
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

      {/* Key metrics row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Paid revenue"
          value={formatMoney(revenue, currency)}
          hint={`${paidOrders} paid orders`}
          icon={<Wallet className="size-4" />}
          tone="success"
        />
        <StatCard
          label="Open orders"
          value={stats?.pending_orders ?? 0}
          hint="Awaiting acceptance or fulfilment"
          icon={<ShoppingBag className="size-4" />}
          tone="warning"
        />
        <StatCard
          label="Products live"
          value={totalProducts}
          hint={`${stats?.unavailable ?? 0} marked unavailable`}
          icon={<Package className="size-4" />}
          tone="info"
        />
        <StatCard
          label="Customer rating"
          value={(Number(stats?.rating ?? 0)).toFixed(1)}
          hint={`${stats?.reviews ?? 0} published reviews`}
          icon={<Star className="size-4" />}
          tone="success"
        />
        <StatCard
          label="Conversion rate"
          value={`${conversionRate}%`}
          hint="Orders vs products listed"
          icon={<Percent className="size-4" />}
          tone="neutral"
          href="/vendor/orders"
        />
        <StatCard
          label="Avg. order value"
          value={formatMoney(averageOrderValue, currency)}
          hint="Per paid order"
          icon={<Fuel className="size-4" />}
          tone="info"
        />
      </div>

      {/* Store & product view analytics */}
      <Card>
        <CardHeader
          title="Store views"
          description="How many times your storefront and products have been viewed."
        />
        <div className="card-pad pt-0">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard
              label="Storefront views"
              value={storeViewStats.total}
              hint={`${storeViewStats.uniqueIps} unique visitors`}
              icon={<Store className="size-4" />}
              tone="info"
            />
            <StatCard
              label="Views today"
              value={storeViewStats.today}
              icon={<Clock className="size-4" />}
              tone="neutral"
            />
            <StatCard
              label="Product views"
              value={productViewStats.total}
              hint={`${productViewStats.topProducts.length} products viewed`}
              icon={<Eye className="size-4" />}
              tone="success"
            />
          </div>

          {productViewStats.topProducts.length > 0 ? (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-ink-900 mb-3">
                Top products by views
              </h3>
              <div className="space-y-2">
                {productViewStats.topProducts.map((product) => (
                  <div
                    key={product.product_id}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-ink-100 bg-white hover:bg-ink-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/vendor/products/${product.product_id}`}
                        className="text-sm font-medium text-ink-900 truncate hover:text-brand-700"
                      >
                        {product.product_name}
                      </Link>
                      <p className="text-xs text-ink-500 truncate">
                        /s/{store.slug}/products/{product.product_slug}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-ink-900">
                        {product.view_count}
                      </span>
                      <p className="text-[10px] text-ink-400">
                        {product.unique_ips} unique
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 text-center py-6 text-ink-400 text-sm">
              No product views recorded yet. Views appear when customers browse
              your products.
            </div>
          )}

          {storeViewStats.recent.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-ink-900 mb-3">
                Recent visitors
              </h3>
              <div className="space-y-2">
                {storeViewStats.recent.map((visit) => (
                  <div
                    key={visit.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-ink-100 bg-white text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink-900 truncate">
                        {visit.user_email ?? "Anonymous visitor"}
                        {visit.user_role ? (
                          <span className="ml-1 text-[10px] text-ink-400">
                            ({visit.user_role})
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-ink-400 truncate">
                        {visit.ip}
                      </p>
                    </div>
                    <p className="text-xs text-ink-400 font-mono">
                      {new Date(visit.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Best sellers section */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="xl:col-span-1">
          <CardHeader
            title="Best sellers"
            description="Your top products by units sold."
            action={<Link href="/vendor/products" className="text-xs font-semibold text-brand-700 hover:underline">All products</Link>}
          />
          <div className="card-pad pt-0">
            {bestSellers.length === 0 ? (
              <EmptyState
                icon={<TrendingUp className="size-5 text-ink-300" />}
                title="No best sellers yet"
                description="Your first sale will appear here as soon as a customer buys a product."
              />
            ) : (
              <div className="space-y-3">
                {bestSellers.map((product) => (
                  <div key={product.id} className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <div className="size-10 rounded-xl bg-ink-100 overflow-hidden">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="size-full object-cover" />
                        ) : (
                          <div className="size-full flex items-center justify-center text-ink-300">
                            <Package className="size-5" />
                          </div>
                        )}
                      </div>
                      <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-white shadow-sm border border-ink-100">
                        <Eye className="size-2.5 text-ink-500" />{" "}
                        <span className="text-[10px] font-bold text-ink-600">{formatNumber(product.views_count)}</span>
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/vendor/products/${product.id}`}
                        className="truncate font-medium text-ink-900 hover:text-brand-700"
                      >
                        {product.name}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-bold text-brand-700">{product.sales_count} sold</span>
                        <span className="text-xs text-ink-400">·</span>
                        <span className="text-xs text-ink-400">{formatMoney(Number(product.price), currency)}</span>
                      </div>
                      <div className="w-full bg-ink-100 rounded-full h-1.5 mt-1.5">
                        <div
                          className="bg-brand-600 h-1.5 rounded-full"
                          style={{ width: `${Math.min(100, (product.sales_count / Math.max(1, bestSellers[0]?.sales_count || 1))) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className={`text-xs font-semibold shrink-0 ${product.is_available ? "text-brand-700" : "text-ink-400"}`}>
                      {product.is_available ? "Live" : "Unavailable"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader
            title="Most viewed"
            description="Products catching the most customer attention."
            action={<Link href="/vendor/products" className="text-xs font-semibold text-brand-700 hover:underline">All products</Link>}
          />
          <div className="card-pad pt-0">
            {mostViewed.length === 0 ? (
              <EmptyState
                icon={<Eye className="size-5 text-ink-300" />}
                title="No views yet"
                description="Product views will appear here once customers start browsing your storefront."
              />
            ) : (
              <div className="space-y-3">
                {mostViewed.map((product) => (
                  <div key={product.id} className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <div className="size-10 rounded-xl bg-ink-100 overflow-hidden">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="size-full object-cover" />
                        ) : (
                          <div className="size-full flex items-center justify-center text-ink-300">
                            <Package className="size-5" />
                          </div>
                        )}
                      </div>
                      <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-white shadow-sm border border-ink-100">
                        <TrendingUp className="size-2.5 text-brand-600" />{" "}
                        <span className="text-[10px] font-bold text-ink-600">{product.sales_count} sold</span>
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/vendor/products/${product.id}`}
                        className="truncate font-medium text-ink-900 hover:text-brand-700"
                      >
                        {product.name}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-bold text-ink-600">{formatNumber(product.views_count)} views</span>
                        <span className="text-xs text-ink-400">·</span>
                        <span className="text-xs text-ink-400">{formatMoney(Number(product.price), currency)}</span>
                      </div>
                      <div className="w-full bg-ink-100 rounded-full h-1.5 mt-1.5">
                        <div
                          className="bg-gold-600 h-1.5 rounded-full"
                          style={{ width: `${Math.min(100, (product.views_count / Math.max(1, mostViewed[0]?.views_count || 1))) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className={`text-xs font-semibold shrink-0 ${product.is_available ? "text-brand-700" : "text-ink-400"}`}>
                      {product.is_available ? "Live" : "Unavailable"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
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
                        <Link href={`/vendor/orders/${order.id}`} className="font-semibold text-ink-900 hover:text-brand-700">
                          {order.reference}
                        </Link>
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
              <ButtonLink href="/vendor/subscription" size="sm" variant="secondary">Free store details</ButtonLink>
              <Link href="/vendor/store" className="btn btn-ghost btn-sm">Settings</Link>
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
                    <Link href={`/vendor/products/${product.id}`} className="truncate hover:text-brand-700">
                      {product.name}
                    </Link>
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
            <Link href="/vendor/customers" className="btn btn-ghost btn-sm"><Users className="size-3.5" /> Customers</Link>
            <Link href="/vendor/quotations" className="btn btn-ghost btn-sm"><ClipboardList className="size-3.5" /> Quotations</Link>
            <Link href="/vendor/messages" className="btn btn-ghost btn-sm"><MessageSquare className="size-3.5" /> Messages</Link>
            <Link href="/vendor/categories" className="btn btn-ghost btn-sm"><Boxes className="size-3.5" /> Categories</Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
