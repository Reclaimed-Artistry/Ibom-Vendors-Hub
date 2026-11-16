import Link from "next/link";
import { Search, Store, Truck, UserRound } from "lucide-react";
import { Logo } from "@/components/logo";
import { CartButton, CartDrawer } from "@/components/cart";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export async function SiteHeader() {
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  const dashboardHref =
    user?.role === "vendor" ? "/vendor" : user?.role === "customer" ? "/account" : user ? "/admin" : "/login";

  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-ink-50/85 backdrop-blur">
      <div className="container-page flex h-20 items-center justify-between gap-4">
        <Logo height={46} href="/" />
        <form action="/browse" className="hidden flex-1 items-center gap-2 lg:flex">
          <div className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              name="q"
              placeholder="Search products, services or stores"
              className="input pl-10"
              aria-label="Search the marketplace"
            />
          </div>
        </form>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href="/browse" className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 sm:flex">
            <Store className="size-4" /> Browse
          </Link>
          <Link href="/track" className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 sm:flex">
            <Truck className="size-4" /> Track
          </Link>
          <Link href={user ? dashboardHref : "/login"} className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 sm:flex">
            <UserRound className="size-4" /> {user ? user.fullName.split(" ")[0] : "Sign in"}
          </Link>
          <CartButton />
          <Link href="/register" className="btn-primary hidden whitespace-nowrap sm:inline-flex">
            Sell on {settings.platform_name.split(" ")[0]}
          </Link>
        </nav>
      </div>
      <CartDrawer />
    </header>
  );
}
