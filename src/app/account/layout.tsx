import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bell } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Avatar } from "@/components/ui";
import { DashboardNav, LogoutButton, MobileNav, type DashboardNavItem } from "@/components/dashboard-nav";

export const metadata: Metadata = { title: "My account · Ibom Vendors Hub" };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["customer"]);
  const unread = await systemDb.maybeOne<{ count: number }>(
    `select count(*)::int as count from notifications where user_id = $1 and read_at is null`,
    [user.id],
  );

  const nav: DashboardNavItem[] = [
    { href: "/account", label: "Overview", icon: "overview" },
    { href: "/account/orders", label: "Orders", icon: "orders" },
    { href: "/account/quotations", label: "Quotations", icon: "quotations" },
    { href: "/account/bookings", label: "Bookings", icon: "bookings" },
    { href: "/account/addresses", label: "Addresses", icon: "store" },
    { href: "/account/reviews", label: "My reviews", icon: "reviews" },
    { href: "/account/notifications", label: "Notifications", icon: "notifications", badge: unread?.count || undefined },
    { href: "/account/profile", label: "Profile & security", icon: "settings" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-ink-50">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6 lg:px-8">
          <aside className="hidden w-60 shrink-0 lg:block">
            <div className="sticky top-24 space-y-4">
              <div className="card-pad">
                <div className="flex items-center gap-3">
                  <Avatar name={user.fullName} src={user.avatarUrl} size={44} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink-900">{user.fullName}</p>
                    <p className="truncate text-xs text-ink-500">{user.email}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-ink-100 bg-white p-2 shadow-sm">
                <DashboardNav items={nav} />
                <div className="mt-1 border-t border-ink-100 pt-1"><LogoutButton /></div>
              </div>
              <Link href="/browse" className="flex items-center justify-between rounded-2xl border border-ink-100 bg-white p-4 text-sm font-semibold text-brand-700 shadow-sm hover:border-brand-300">
                Continue shopping <ArrowRight className="size-4" />
              </Link>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-ink-100 bg-white px-4 py-3 shadow-sm lg:hidden">
              <div className="flex items-center gap-3">
                <MobileNav items={nav} title="My account" />
                <span className="truncate text-sm font-semibold text-ink-900">{user.fullName}</span>
              </div>
              <Link href="/account/notifications" className="btn btn-ghost btn-sm relative" aria-label="Notifications">
                <Bell className="size-4" />
                {unread?.count ? (
                  <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                    {unread.count > 9 ? "9+" : unread.count}
                  </span>
                ) : null}
              </Link>
            </div>
            <div className="pb-12">{children}</div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
