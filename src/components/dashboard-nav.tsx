"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarClock,
  CreditCard,
  FileText,
  Flag,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  Megaphone,
  MessageSquare,
  Package,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  Tags,
  Users,
  Wallet,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

const ICONS = {
  overview: LayoutDashboard,
  products: Package,
  orders: ShoppingBag,
  quotations: FileText,
  bookings: CalendarClock,
  customers: Users,
  reviews: Star,
  messages: MessageSquare,
  subscription: CreditCard,
  store: Store,
  settings: Settings,
  notifications: Bell,
  vendors: Store,
  subscriptions: CreditCard,
  payments: Wallet,
  categories: Tags,
  announcements: Megaphone,
  flags: Flag,
  subdomains: ShieldCheck,
  audit: ScrollText,
  emails: Mail,
  help: MessageSquare,
} as const;

export type DashboardIcon = keyof typeof ICONS;

export interface DashboardNavItem {
  href: string;
  label: string;
  icon: DashboardIcon;
  badge?: number;
  locked?: boolean;
}

export function DashboardNav({ items, compact = false }: { items: DashboardNavItem[]; compact?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className={compact ? "grid gap-1" : "space-y-1"}>
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? LayoutDashboard;
        const active = !item.locked && (pathname === item.href || (item.href !== "/vendor" && item.href !== "/admin" && pathname.startsWith(`${item.href}/`)));
        return (
          <Link
            key={item.href}
            href={item.locked ? "/vendor/subscription?suspended=1" : item.href}
            title={item.locked ? "Suspended — renew your subscription to unlock" : undefined}
            aria-disabled={item.locked || undefined}
            className={`sidebar-link ${active ? "sidebar-link-active" : ""} ${item.locked ? "opacity-55 hover:bg-red-50/50 hover:text-ink-600" : ""}`}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="flex-1 truncate">{item.label}</span>
            {item.locked ? (
              <Lock className="size-3.5 shrink-0 text-red-500" aria-label="Locked until renewal" />
            ) : item.badge ? (
              <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">{item.badge}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function LogoutButton({ label = "Sign out" }: { label?: string }) {
  return (
    <form action={logoutAction}>
      <button type="submit" className="btn btn-ghost btn-sm w-full justify-start text-ink-500">
        <LogOut className="size-4" aria-hidden />
        {label}
      </button>
    </form>
  );
}

export function MobileNav({ items, title }: { items: DashboardNavItem[]; title: string }) {
  const pathname = usePathname();
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (detailsRef.current) detailsRef.current.open = false;
  }, [pathname]);

  return (
    <details ref={detailsRef} className="group shrink-0 lg:hidden">
      <summary className="btn btn-secondary btn-sm cursor-pointer list-none">
        <span>{title}</span>
      </summary>
      <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[75dvh] overflow-y-auto rounded-2xl border border-ink-100 bg-white p-2 shadow-xl">
        <DashboardNav items={items} compact />
        <div className="mt-1 border-t border-ink-100 pt-1">
          <LogoutButton />
        </div>
      </div>
      <span className="sr-only">{pathname}</span>
    </details>
  );
}
