"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarClock,
  CreditCard,
  FileText,
  Flag,
  LayoutDashboard,
  LogOut,
  Mail,
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
}

export function DashboardNav({ items, compact = false }: { items: DashboardNavItem[]; compact?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className={compact ? "grid gap-1" : "space-y-1"}>
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? LayoutDashboard;
        const active = pathname === item.href || (item.href !== "/vendor" && item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`sidebar-link ${active ? "sidebar-link-active" : ""}`}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge ? (
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
  return (
    <details className="group lg:hidden">
      <summary className="btn btn-secondary btn-sm cursor-pointer list-none">
        <span>{title}</span>
      </summary>
      <div className="mt-2 rounded-2xl border border-ink-100 bg-white p-2 shadow-sm">
        <DashboardNav items={items} compact />
        <div className="mt-1 border-t border-ink-100 pt-1">
          <LogoutButton />
        </div>
      </div>
      <span className="sr-only">{pathname}</span>
    </details>
  );
}
