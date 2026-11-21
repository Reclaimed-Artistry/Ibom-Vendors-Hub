"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, LogOut, ExternalLink } from "lucide-react";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { DashboardNav, type DashboardNavItem } from "@/components/dashboard-nav";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui";

interface MobileVendorSidebarProps {
  nav: DashboardNavItem[];
  store: {
    name: string;
    slug: string;
    status: string;
    category?: { name: string } | null;
  };
  base: string;
  isSubscriptionExpired: boolean;
  user: {
    email: string;
  };
  pathname: string;
}

export function MobileVendorSidebar({
  nav,
  store,
  base,
  isSubscriptionExpired,
  user,
  pathname,
}: MobileVendorSidebarProps) {
  const [open, setOpen] = useState(false);
  const currentPath = usePathname();

  useEffect(() => {
    // Close drawer on route change
    if (open && currentPath !== pathname) {
      setOpen(false);
    }
  }, [currentPath, pathname, open]);

  const badgeTone =
    isSubscriptionExpired
      ? "danger"
      : store.status === "active"
        ? "success"
        : store.status === "pending"
          ? "warning"
          : "danger";

  return (
    <>
      {/* Hamburger button (mobile only) */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="lg:hidden p-2 text-ink-700 hover:bg-ink-100 rounded-lg"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {/* Slide-over drawer (mobile only) */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm lg:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <aside
            className="fixed inset-y-0 left-0 z-50 w-full max-w-xs bg-white border-r border-ink-100 shadow-2xl transform transition-transform duration-300 lg:hidden"
            aria-label="Vendor navigation"
          >
            <div className="flex flex-col h-full">
              {/* Drawer header */}
              <div className="p-4 border-b border-ink-100">
                <div className="flex items-center gap-2">
                  <Logo height={24} />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                      Vendor workspace
                    </p>
                    <p className="text-base font-bold text-ink-900 truncate">
                      {store.name}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
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
                    {isSubscriptionExpired
                      ? "suspended · expired"
                      : store.status}
                  </Badge>
                  {store.category ? (
                    <span className="text-xs text-ink-500">{store.category.name}</span>
                  ) : null}
                </div>
                <Link
                  href={base}
                  target="_blank"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
                >
                  View storefront <ExternalLink className="size-3" />
                </Link>
              </div>

              {/* Navigation */}
              <div className="flex-1 overflow-y-auto p-2">
                <DashboardNav
                  items={nav.map((item) => ({
                    ...item,
                    locked: item.locked ?? false,
                  }))}
                  variant="list"
                />
                <div className="mt-2 border-t border-ink-100 pt-2">
                  <form
                    action={logoutAction}
                    className="w-full"
                  >
                    <button
                      type="submit"
                      className="btn btn-ghost btn-sm w-full justify-start text-ink-500"
                    >
                      <LogOut className="mr-2 size-4" aria-hidden /> Sign out
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
