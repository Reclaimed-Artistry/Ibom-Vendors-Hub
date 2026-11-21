import { NO_INDEX } from "@/lib/seo";
import { FREE_STORE_ACCESS, FREE_STORE_MESSAGE } from "@/lib/store-access-policy";
import { LiveDashboard } from "@/components/live-dashboard";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { ArrowUpRight, Bell, Clock, ExternalLink, Home, Lock, MailWarning, Settings, ShieldAlert } from "lucide-react";
import { getCurrentUser, getVendorContext, getVendorContextForStore } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { storeBase } from "@/lib/storefront-base";
import { storefrontUrl } from "@/lib/domains";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui";
import { DashboardNav, LogoutButton, type DashboardNavItem } from "@/components/dashboard-nav";
import { Logo } from "@/components/logo";
import { MobileVendorSidebar } from "@/components/mobile-vendor-sidebar";
import { VendorAnnouncements } from "@/components/announcement-strip";
import { SubscriptionCountdown } from "@/components/subscription-countdown";
import { ReviewCountdown } from "@/components/review-countdown";
import { WhatsAppAdminButton } from "@/components/whatsapp-admin-button";

export const metadata: Metadata = { title: "Vendor dashboard · Ibom Vendors Hub", robots: NO_INDEX };

function daysLeft(expiresAt: string | null): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000));
}

export default async function VendorLayout({
  children,
  searchParams,
}: {
  children: React.ReactNode;
  searchParams?: { viewAs?: string };
}) {
  const actingUser = await getCurrentUser();
  const viewAsStoreId = searchParams?.viewAs;

  let user, store, subscription, lastSubscription, effectiveExpiresAt, effectiveStartedAt, isSubscriptionExpired, category;

  if (viewAsStoreId && actingUser && (actingUser.role === "admin" || actingUser.role === "super_admin")) {
    // Platform administrator viewing as a specific vendor's storefront
    const ctx = await getVendorContextForStore({ storeId: viewAsStoreId, actingUser });
    user = ctx.user;
    store = ctx.store;
    subscription = ctx.subscription;
    lastSubscription = ctx.lastSubscription;
    effectiveExpiresAt = ctx.effectiveExpiresAt;
    effectiveStartedAt = ctx.effectiveStartedAt;
    isSubscriptionExpired = ctx.isSubscriptionExpired;
    category = ctx.category;
  } else {
    const ctx = await getVendorContext();
    user = ctx.user;
    store = ctx.store;
    subscription = ctx.subscription;
    lastSubscription = ctx.lastSubscription;
    effectiveExpiresAt = ctx.effectiveExpiresAt;
    effectiveStartedAt = ctx.effectiveStartedAt;
    isSubscriptionExpired = ctx.isSubscriptionExpired;
    category = ctx.category;
  }

  const pathname = (await headers()).get("x-ivh-pathname") ?? "";
  if (
    isSubscriptionExpired &&
    pathname &&
    pathname !== "/vendor/subscription" &&
    !pathname.startsWith("/vendor/subscription/") &&
    pathname !== "/vendor/onboarding"
  ) {
    redirect("/vendor/subscription?suspended=1");
  }

  const base = await storeBase(store.slug);
  const [counts, unread] = await Promise.all([
    isSubscriptionExpired
      ? Promise.resolve(null)
      : systemDb.maybeOne<{ orders: number; quotations: number; bookings: number; messages: number; reviews: number }>(
          `select
             (select count(*)::int from orders where store_id = $1 and status not in ('completed','cancelled','rejected')) as orders,
             (select count(*)::int from service_quotations where store_id = $1 and status in ('requested','quoted')) as quotations,
             (select count(*)::int from service_bookings where store_id = $1 and status in ('requested','confirmed','rescheduled')) as bookings,
             (select count(*)::int from customer_messages where store_id = $1 and status in ('new','open')) as messages,
             (select count(*)::int from reviews where store_id = $1 and vendor_response is null) as reviews`,
          [store.id],
        ),
    systemDb.maybeOne<{ count: number }>(
      `select count(*)::int as count from notifications where user_id = $1 and read_at is null`,
      [user.id],
    ),
  ]);

  const nav: DashboardNavItem[] = [
    { href: "/vendor/settings", label: "Account settings", icon: "settings", locked: isSubscriptionExpired },
    { href: "/vendor", label: "Overview", icon: "overview", locked: isSubscriptionExpired },
    { href: "/vendor/orders", label: "Orders", icon: "orders", badge: counts?.orders || undefined, locked: isSubscriptionExpired },
    { href: "/vendor/payment-approvals", label: "Payment approvals", icon: "payments", locked: isSubscriptionExpired },
    { href: "/vendor/payouts", label: "Wallet & payouts", icon: "payments", locked: isSubscriptionExpired },
    { href: "/vendor/products", label: "Products & services", icon: "products", locked: isSubscriptionExpired },
    { href: "/vendor/announcements", label: "Announcements", icon: "announcements", locked: isSubscriptionExpired },
    { href: "/vendor/categories", label: "Categories", icon: "categories", locked: isSubscriptionExpired },
    { href: "/vendor/quotations", label: "Quotations", icon: "quotations", badge: counts?.quotations || undefined, locked: isSubscriptionExpired },
    { href: "/vendor/bookings", label: "Bookings", icon: "bookings", badge: counts?.bookings || undefined, locked: isSubscriptionExpired },
    { href: "/vendor/customers", label: "Customers", icon: "customers", locked: isSubscriptionExpired },
    { href: "/vendor/reviews", label: "Reviews", icon: "reviews", badge: counts?.reviews || undefined, locked: isSubscriptionExpired },
    { href: "/vendor/messages", label: "Messages", icon: "messages", badge: counts?.messages || undefined, locked: isSubscriptionExpired },
    { href: "/vendor/subscription", label: "Free store", icon: "subscription" },
    { href: "/vendor/store", label: "Store profile", icon: "store", locked: isSubscriptionExpired },
  ];

  const remaining = daysLeft(effectiveExpiresAt);
  const expiringSoon = !FREE_STORE_ACCESS && !isSubscriptionExpired && remaining > 0 && remaining <= 5;
  const displayPlanName =
    subscription?.plan_name ??
    (effectiveExpiresAt && !subscription ? "Admin access grant" : lastSubscription?.plan_name ?? "No active plan");

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-ink-50">
      <LiveDashboard />
      <VendorAnnouncements />
      <div className="mx-auto max-w-[1440px] px-4 py-3 text-sm font-semibold text-brand-700">{FREE_STORE_MESSAGE}</div>
      <div className="mx-auto flex max-w-[1440px] gap-6 px-4 py-5 lg:px-8">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-5 space-y-4">
            <div className="card-pad">
              <Logo height={28} />
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Vendor workspace</p>
              <p className="mt-1 truncate text-base font-bold text-ink-900">{store.name}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge
                  tone={
                    isSubscriptionExpired
                      ? "danger"
                      : store.status === "active"
                        ? "success"
                        : store.status === "pending"
                          ? "warning"
                          : "danger"
                  }
                >
                  {isSubscriptionExpired ? "suspended · expired" : store.status}
                </Badge>
                {category ? <span className="text-xs text-ink-500">{category.name}</span> : null}
              </div>
              <Link href={base} target="_blank" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
                View storefront <ExternalLink className="size-3" />
              </Link>
            </div>

            <div className="rounded-2xl border border-ink-100 bg-white p-2 shadow-sm">
              <DashboardNav items={nav} variant="list" />
              <div className="mt-1 border-t border-ink-100 pt-1">
                <LogoutButton />
              </div>
            </div>

            <div className={`rounded-2xl border p-4 shadow-sm ${isSubscriptionExpired ? "border-red-200 bg-white" : "border-ink-100 bg-white"}`}>
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
                <Clock className="size-3.5" /> Subscription countdown
              </p>
              <p className="mt-1 text-sm font-semibold text-ink-900">{displayPlanName}</p>
              <SubscriptionCountdown
                variant="sidebar"
                expiresAt={effectiveExpiresAt ?? lastSubscription?.expires_at ?? null}
                startedAt={effectiveStartedAt}
                planName={displayPlanName}
                status={subscription?.status ?? lastSubscription?.status ?? null}
                isSuspendedForExpiry={isSubscriptionExpired}
              />
              <Link href="/vendor/subscription" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
                {isSubscriptionExpired ? "Renew subscription" : "Manage plan"} <ArrowUpRight className="size-3" />
              </Link>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <MobileVendorSidebar
            nav={nav}
            store={{
              name: store.name,
              slug: store.slug,
              status: store.status,
              category: store.category ?? null,
            }}
            base={base}
            isSubscriptionExpired={isSubscriptionExpired}
            user={{ email: user.email }}
            pathname={pathname}
          />
          <header className="relative mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-100 bg-white px-4 py-3 shadow-sm">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex items-center gap-2 shrink-0">
                {pathname === "/vendor" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-brand-800 px-3 py-1.5 text-xs font-semibold text-white">
                    <Home className="size-3.5" /> Dashboard
                  </span>
                ) : (
                  <Link href="/vendor" className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50 hover:border-brand-300">
                    <Home className="size-3.5" /> Dashboard
                  </Link>
                )}
                {pathname === "/vendor/settings" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-brand-800 px-3 py-1.5 text-xs font-semibold text-white">
                    <Settings className="size-3.5" /> Settings
                  </span>
                ) : (
                  <Link href="/vendor/settings" className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50 hover:border-brand-300">
                    <Settings className="size-3.5" /> Settings
                  </Link>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-900">{store.name}</p>
                <p className="truncate text-xs text-ink-500">
                  {storefrontUrl(store.slug)}
                  <span className="text-ink-300"> · </span>
                  {user.email}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SubscriptionCountdown
                variant="header"
                expiresAt={effectiveExpiresAt ?? lastSubscription?.expires_at ?? null}
                isSuspendedForExpiry={isSubscriptionExpired}
              />
              {isSubscriptionExpired ? (
                <span className="btn btn-ghost btn-sm cursor-not-allowed opacity-50" title="Locked until subscription renewal">
                  <Lock className="size-4 text-red-500" />
                </span>
              ) : (
                <Link href="/vendor/notifications" className="btn btn-ghost btn-sm relative" aria-label="Notifications">
                  <Bell className="size-4" />
                  {unread?.count ? (
                    <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                      {unread.count > 9 ? "9+" : unread.count}
                    </span>
                  ) : null}
                </Link>
              )}
              <Link href={base} target="_blank" className="btn btn-secondary btn-sm hidden sm:inline-flex">
                Storefront <ExternalLink className="size-3.5" />
              </Link>
              <WhatsAppAdminButton />
            </div>
          </header>

          <div className="space-y-4">
            {isSubscriptionExpired ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">
                <p className="flex items-start gap-2.5">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-red-600" />
                  <span>
                    <strong className="font-semibold">Account suspended — subscription expired</strong>
                    {lastSubscription?.expires_at ? ` (${formatDateTime(lastSubscription.expires_at)})` : ""}. Your vendor
                    dashboard tools and public storefront are locked until you renew your subscription. Your products,
                    images and order history remain intact.
                  </span>
                </p>
              </div>
            ) : null}
            {!isSubscriptionExpired && store.status === "pending" ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
                <p className="flex items-start gap-2.5">
                  <Clock className="mt-0.5 size-4 shrink-0 text-amber-700" />
                  <span>
                    <strong className="font-semibold">Storefront under 48-hour verification review.</strong>{" "}
                    Our admin team is reviewing your uploaded Proof of Residence, NIN, and registration details. You can
                    add and publish products right now — we will notify you and open your store publicly as soon as it is approved.
                  </span>
                </p>
                <ReviewCountdown deadlineAt={store.review_deadline_at} createdAt={store.created_at} compact />
              </div>
            ) : null}
            {store.status === "rejected" ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">
                <p className="flex items-start gap-2.5">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-red-600" />
                  <span>
                    <strong className="font-semibold">Storefront application declined</strong>
                    {store.rejection_reason ? ` — Reason: ${store.rejection_reason}` : "."}{" "}
                    Update your Proof of Residence or identity details in Store Profile to re-submit for a fresh 48-hour review.
                  </span>
                </p>
                <Link href="/vendor/store" className="btn btn-primary btn-sm shrink-0">
                  Update verification documents
                </Link>
              </div>
            ) : null}
            {store.status === "suspended" || store.manual_suspension ? (
              <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <span>
                  Store suspended{store.suspension_reason ? `: ${store.suspension_reason}` : ""}. Customer-facing features and store edits are paused while your data is retained.
                </span>
              </div>
            ) : null}
            {!user.emailVerified ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm text-ink-700">
                <p className="flex items-start gap-2">
                  <MailWarning className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <span>Verify your email address to receive order alerts and important store updates.</span>
                </p>
                <Link href={`/verify-email?email=${encodeURIComponent(user.email)}`} className="btn btn-secondary btn-sm">Verify email</Link>
              </div>
            ) : null}
            {expiringSoon ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
                <p>
                  Your <strong>{displayPlanName}</strong> expires in{" "}
                  <strong>
                    {remaining} day{remaining === 1 ? "" : "s"}
                  </strong>
                  . Renew early to avoid automatic account suspension.
                </p>
                <Link href="/vendor/subscription" className="btn btn-primary btn-sm">Renew now</Link>
              </div>
            ) : null}
          </div>

          <main className="mt-4 pb-12">{children}</main>
        </div>
      </div>
    </div>
  );
}
