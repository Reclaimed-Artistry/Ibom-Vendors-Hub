import Link from "next/link";
import { LayoutDashboard, Search, Store, Truck, UserPlus, UserRound } from "lucide-react";
import { Logo } from "@/components/logo";
import { CartButton } from "@/components/cart";
import { getCurrentUser } from "@/lib/auth";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const dashboardHref =
    user?.role === "vendor" ? "/vendor" : user?.role === "customer" ? "/account" : user ? "/admin" : "/login";

  return (
    <header className="sticky top-0 z-40 w-full max-w-full border-b border-ink-100 bg-ink-50/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-2 sm:h-20 sm:gap-4">
        <Logo height={44} href="/" />
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
        <nav className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2">
          <Link href="/browse" className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 sm:flex">
            <Store className="size-4" /> Browse
          </Link>
          <Link href="/track" className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 sm:flex">
            <Truck className="size-4" /> Track
          </Link>
          <Link
            href={user ? dashboardHref : "/login"}
            className="inline-flex items-center gap-1 rounded-xl px-2 py-2 text-xs font-medium text-ink-700 hover:bg-ink-100 sm:gap-1.5 sm:px-3 sm:text-sm"
          >
            <UserRound className="size-4 shrink-0" />
            <span className="max-w-[4.5rem] truncate sm:max-w-[8rem]">
              {user ? user.fullName.split(" ")[0] : "Sign in"}
            </span>
          </Link>
          <CartButton />
          {!user ? (
            <Link href="/register/customer" className="btn-primary hidden whitespace-nowrap sm:inline-flex">
              <UserPlus className="size-4" /> Create account
            </Link>
          ) : user.role === "customer" ? (
            <Link href="/register" className="btn-primary whitespace-nowrap px-2.5 py-2 text-xs sm:px-4 sm:py-2.5 sm:text-sm">
              <Store className="size-4 shrink-0" />
              <span className="sm:hidden">Open shop</span>
              <span className="hidden sm:inline">Create a storefront</span>
            </Link>
          ) : user.role === "vendor" ? (
            <Link href="/vendor" className="btn-primary hidden whitespace-nowrap sm:inline-flex">
              <LayoutDashboard className="size-4" /> Vendor dashboard
            </Link>
          ) : (
            <Link href="/admin" className="btn-primary hidden whitespace-nowrap sm:inline-flex">
              <LayoutDashboard className="size-4" /> Admin console
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
