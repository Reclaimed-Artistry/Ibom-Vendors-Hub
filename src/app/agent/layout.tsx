import { NO_INDEX } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { Bell, ExternalLink, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { getLoanAgentByEmail } from "@/lib/loan-agents";
import { redirect } from "next/navigation";
import { DashboardNav, LogoutButton, type DashboardNavItem } from "@/components/dashboard-nav";
import { Logo } from "@/components/logo";
import { User } from "lucide-react";

export const metadata: Metadata = { title: "Agent · Ibom Vendors Hub", robots: NO_INDEX };

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["admin"]);

  // Only registered loan agents can access the agent dashboard.
  if (!getLoanAgentByEmail(user.email)) {
    redirect("/forbidden");
  }

  const [unread] = await Promise.all([
    systemDb.maybeOne<{ count: number }>(`select count(*)::int as count from notifications where user_id = $1 and read_at is null`, [user.id]),
  ]);

  const nav: DashboardNavItem[] = [
    { href: "/agent/loans", label: "My Loans", icon: "audit" },
    { href: "/admin/loan-assessments", label: "Loan Assessments", icon: "audit" },
    { href: "/admin/notifications", label: "Notifications", icon: "notifications", badge: unread?.count || undefined },
  ];

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-auto bg-ink-50">
      <div className="mx-auto flex max-w-[1500px] gap-6 px-4 py-5 lg:px-8">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-5 space-y-4">
            <div className="card-pad">
              <Logo height={30} />
              <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                <ShieldCheck className="size-3.5" /> Loan Officer
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
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-900">Loan Officer</p>
                <p className="truncate text-xs text-ink-500">{user.fullName} · {user.email}</p>
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
            </div>
          </header>
          <main className="pb-12">{children}</main>
        </div>
      </div>
    </div>
  );
}
