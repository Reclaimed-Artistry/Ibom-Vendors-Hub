import { NO_INDEX } from "@/lib/seo";
import { LiveDashboard } from "@/components/live-dashboard";
import type { Metadata } from "next";
import Link from "next/link";
import { Bell, ExternalLink, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { DashboardNav, LogoutButton, MobileNav, type DashboardNavItem } from "@/components/dashboard-nav";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Admin · Ibom Vendors Hub", robots: NO_INDEX };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const [pending, unread] = await Promise.all([
    systemDb.maybeOne<{ pending: number; requests: number; messages: number }>(
      `select (select count(*)::int from stores where status = 'pending') as pending,
              (select count(*)::int from subdomain_change_requests where status = 'pending') as requests,
              (select count(*)::int from customer_messages where status in ('new','open')) as messages`,
    ),
    systemDb.maybeOne<{ count: number }>(`select count(*)::int as count from notifications where user_id = $1 and read_at is null`, [user.id]),
  ]);

  const nav: DashboardNavItem[] = [
    { href: "/admin", label: "Overview", icon: "overview" },
    { href: "/admin/vendors", label: "Vendors", icon: "vendors", badge: pending?.pending || undefined },
    { href: "/admin/customers", label: "Customers", icon: "customers" },
    { href: "/admin/subscriptions", label: "Subscriptions", icon: "subscriptions" },
    { href: "/admin/payments", label: "Payments", icon: "payments" },
    { href: "/admin/categories", label: "Categories & flags", icon: "categories" },
    { href: "/admin/announcements", label: "Announcements", icon: "announcements" },
    { href: "/admin/subdomains", label: "Subdomain requests", icon: "subdomains", badge: pending?.requests || undefined },
    { href: "/admin/messages", label: "Messages", icon: "messages", badge: pending?.messages || undefined },
    { href: "/admin/emails", label: "Emails", icon: "emails" },
    { href: "/admin/abandoned-carts", label: "Abandoned carts", icon: "recovery" },
    { href: "/admin/audit", label: "Audit log", icon: "audit" },
    { href: "/admin/notifications", label: "Notifications", icon: "notifications", badge: unread?.count || undefined },
    { href: "/admin/settings", label: "Platform settings", icon: "settings" },
  ];

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-ink-50">
      <LiveDashboard />
      <div className="mx-auto flex max-w-[1500px] gap-6 px-4 py-5 lg:px-8">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-5 space-y-4">
            <div className="card-pad">
              <Logo height={30} />
              <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                <ShieldCheck className="size-3.5" /> Platform control
              </p>
              <p className="mt-1 truncate text-xs text-ink-500">{user.email}</p>
              <Link href="/" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
                Public site <ExternalLink className="size-3" />
              </Link>
            </div>
            <div className="rounded-2xl border border-ink-100 bg-white p-2 shadow-sm">
              <DashboardNav items={nav} />
              <div className="mt-1 border-t border-ink-100 pt-1"><LogoutButton /></div>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="relative mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-100 bg-white px-4 py-3 shadow-sm">
            <div className="flex min-w-0 items-center gap-3">
              <MobileNav items={nav} title="Admin" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-900">Administrator</p>
                <p className="truncate text-xs text-ink-500">{user.fullName} · {user.role}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/admin/notifications" className="btn btn-ghost btn-sm relative" aria-label="Notifications">
                <Bell className="size-4" />
                {unread?.count ? (
                  <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                    {unread.count > 9 ? "9+" : unread.count}
                  </span>
                ) : null}
              </Link>
              <Link href="/admin/vendors?status=pending" className="btn btn-secondary btn-sm">Review queue</Link>
            </div>
          </header>
          <main className="pb-12">{children}</main>
        </div>
      </div>
    </div>
  );
}
