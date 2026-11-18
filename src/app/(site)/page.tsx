import { StoreImage } from "@/components/store-image";
import { FeaturedStoreCarousel } from "@/components/featured-store-carousel";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Clock,
  Droplets,
  Hammer,
  HardHat,
  MapPin,
  Package,
  Paintbrush,
  Scissors,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  Truck,
  Utensils,
  Wrench,
  Zap,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getCategoriesWithCounts, getMarketplaceHighlights, searchMarketplace } from "@/lib/storefront";
import { getSettings } from "@/lib/settings";
import { formatMoney, truncate } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  utensils: Utensils,
  shirt: ShoppingBag,
  footprints: Package,
  cpu: Package,
  sparkles: Star,
  hammer: Hammer,
  zap: Zap,
  droplets: Droplets,
  paintbrush: Paintbrush,
  "hard-hat": HardHat,
  wrench: Wrench,
  scissors: Scissors,
  briefcase: Store,
  "shopping-bag": ShoppingBag,
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const [user, settings, categories, highlights, featuredProducts] = await Promise.all([
    getCurrentUser(),
    getSettings(),
    getCategoriesWithCounts(),
    getMarketplaceHighlights(),
    searchMarketplace({ sort: "rating", limit: 8 }),
  ]);

  const featuredSlides = highlights.featured.map((store) => ({
    id: store.id, slug: store.slug, name: store.name,
    cover_url: store.cover_url, logo_url: store.logo_url,
    category_name: store.category_name, city: store.city, state: store.state,
    summary: store.tagline || store.description || "Explore this independent storefront.",
    rating_avg: store.rating_avg, product_count: store.product_count,
  }));

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink-900">
        <div className="absolute inset-0 opacity-70" aria-hidden>
          <div className="absolute -right-32 -top-40 size-[38rem] rounded-full bg-brand-800/60 blur-3xl" />
          <div className="absolute -bottom-48 left-1/4 size-[32rem] rounded-full bg-gold-600/25 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.18),transparent_45%)]" />
        </div>
        <div className="container-page relative grid gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-brand-200">
              <MapPin className="size-3.5" /> Akwa Ibom&apos;s own marketplace
            </span>
            <h1 className="mt-6 font-display text-4xl leading-[1.05] text-white sm:text-5xl lg:text-6xl">
              Every business.
              <br />
              <span className="text-brand-300">One address.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-ink-200">
              {highlights.stats.stores > 0 ? (
                <>
                  Restaurants, fashion houses, shoemakers, gadget stores and professionals from across the state. Discover{" "}
                  {highlights.stats.stores} verified vendor{highlights.stats.stores === 1 ? "" : "s"}, order in minutes, and track
                  every step — all in one place.
                </>
              ) : (
                <>
                  Restaurants, fashion houses, shoemakers, gadget stores and professionals from across Akwa Ibom are moving online
                  here. Open your storefront today and be the first business customers find on the hub.
                </>
              )}
            </p>
            <form action="/browse" className="mt-8 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Package className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-400" />
                <input
                  name="q"
                  placeholder="What are you looking for today?"
                  className="w-full rounded-2xl border border-white/15 bg-white px-12 py-4 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-4 focus:ring-brand-500/30"
                  aria-label="Search products and services"
                />
              </div>
              <button className="btn-gold rounded-2xl px-7 py-4 text-sm">Search marketplace</button>
            </form>
            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-ink-300">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-4 text-brand-400" /> Verified vendors</span>
              <span className="inline-flex items-center gap-1.5"><Truck className="size-4 text-brand-400" /> Delivery & pickup</span>
              <span className="inline-flex items-center gap-1.5"><Clock className="size-4 text-brand-400" /> Live order tracking</span>
            </div>
          </div>

          <div className="relative">
            {highlights.featured.length === 0 ? (
              <div className="rounded-3xl border border-white/15 bg-white/5 p-6 backdrop-blur">
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-200">
                  <Store className="size-3.5" /> Now onboarding vendors
                </span>
                <p className="mt-4 font-display text-2xl text-white">Your shop could be the first storefront here.</p>
                <p className="mt-2 text-sm leading-6 text-ink-200">
                  A catalogue, order dashboard, payment receipts and a storefront on your own subdomain — ready in minutes.
                </p>
                {!user ? (
                  <Link href="/register/customer" className="btn-gold mt-5 inline-flex">
                    Create an account to get started <ArrowRight className="ml-1 size-4" />
                  </Link>
                ) : user.role === "customer" ? (
                  <Link href="/register" className="btn-gold mt-5 inline-flex">
                    Create your storefront <ArrowRight className="ml-1 size-4" />
                  </Link>
                ) : (
                  <Link href={user.role === "vendor" ? "/vendor" : "/admin"} className="btn-gold mt-5 inline-flex">
                    Open dashboard <ArrowRight className="ml-1 size-4" />
                  </Link>
                )}
                <dl className="mt-6 grid grid-cols-3 gap-2 text-center text-white sm:gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-2 sm:p-3">
                    <dt className="whitespace-nowrap text-[clamp(8px,2.6vw,10px)] uppercase tracking-wide text-ink-300">Trial</dt>
                    <dd className="mt-1 text-sm font-semibold">{settings.default_trial_days}d</dd>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-2 sm:p-3">
                    <dt className="whitespace-nowrap text-[clamp(8px,2.6vw,10px)] uppercase tracking-wide text-ink-300">Setup fee</dt>
                    <dd className="mt-1 text-sm font-semibold">₦0</dd>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-2 sm:p-3">
                    <dt className="whitespace-nowrap text-[clamp(8px,2.6vw,10px)] uppercase tracking-wide text-ink-300">Categories</dt>
                    <dd className="mt-1 text-sm font-semibold">{categories.length}</dd>
                  </div>
                </dl>
              </div>
            ) : null}
            <FeaturedStoreCarousel stores={featuredSlides} label="Discover featured vendors" />
            {highlights.stats.products > 0 ? (
              <div className="absolute -bottom-6 left-1/2 hidden -translate-x-1/2 items-center gap-3 rounded-2xl border border-white/10 bg-ink-800/90 px-4 py-3 backdrop-blur lg:flex">
                <BadgeCheck className="size-5 text-brand-400" />
                <p className="text-xs text-ink-200">
                  <span className="font-semibold text-white">{highlights.stats.products} live listings</span> across {highlights.stats.categories} categories
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container-page py-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Shop by category</p>
            <h2 className="mt-2 font-display text-2xl text-ink-900 sm:text-3xl">Built for how Akwa Ibom does business</h2>
          </div>
          <Link href="/browse" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-800 hover:text-brand-900">
            Explore everything <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => {
            const Icon = ICONS[category.icon ?? ""] ?? Store;
            return (
              <Link
                key={category.id}
                href={`/browse?category=${category.slug}`}
                className="group card flex items-start gap-3 p-4 transition-colors hover:border-brand-300"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 group-hover:bg-brand-100">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink-900">{category.name}</p>
                  <p className="mt-0.5 text-xs text-ink-400">{category.store_count} vendor{category.store_count === 1 ? "" : "s"}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Featured vendors */}
      <section className="bg-white py-14">
        <div className="container-page">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Featured storefronts</p>
              <h2 className="mt-2 font-display text-2xl text-ink-900 sm:text-3xl">Vendors customers keep coming back to</h2>
            </div>
            <Link href="/stores" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-800 hover:text-brand-900">
              All vendors <ArrowRight className="size-4" />
            </Link>
          </div>
          {highlights.featured.length === 0 ? (
            <div className="mt-7 rounded-2xl border border-dashed border-ink-200 bg-ink-50 p-8 text-center">
              <p className="font-display text-xl text-ink-900">No storefronts have opened yet.</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-500">
                Vendors are onboarding now. If you run a business in Akwa Ibom, you can claim your address before your competitors do.
              </p>
              <Link href="/register" className="btn-primary mt-5 inline-flex">
                Create your storefront
              </Link>
            </div>
          ) : null}
          <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {highlights.featured.slice(0, 6).map((store) => (
              <Link key={store.id} href={`/s/${store.slug}`} className="group card flex h-80 min-w-0 flex-col overflow-hidden">
                <div className="relative h-28 shrink-0 overflow-hidden">
                  <StoreImage kind="cover" src={store.cover_url} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <span className="absolute left-3 right-3 top-3 w-fit max-w-[calc(100%-1.5rem)] truncate rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-ink-700">
                    {store.category_name}
                  </span>
                </div>
                <div className="flex min-h-0 flex-1 flex-col p-4">
                  <div className="flex items-start gap-3">
                    <StoreImage kind="logo" src={store.logo_url} alt="" className="size-11 shrink-0 rounded-xl border border-ink-100 bg-white object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-900">{store.name}</p>
                      <p className="truncate text-xs text-ink-400">{store.city}, {store.state}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold-600">
                      <Star className="size-3.5 fill-current" /> {store.rating_avg || "New"}
                    </span>
                  </div>
                  <p className="mt-3 h-12 shrink-0 line-clamp-2 text-sm leading-6 text-ink-500">{store.tagline ?? truncate(store.description, 110)}</p>
                  <p className="mt-auto pt-3 text-xs font-medium text-brand-800">{store.product_count} listings · view storefront →</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Product discovery */}
      <section className="container-page py-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Trending now</p>
            <h2 className="mt-2 font-display text-2xl text-ink-900 sm:text-3xl">Popular this week</h2>
          </div>
          <Link href="/browse?sort=rating" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-800 hover:text-brand-900">
            See all products <ArrowRight className="size-4" />
          </Link>
        </div>
        {featuredProducts.products.length === 0 ? (
          <div className="mt-7 rounded-2xl border border-dashed border-ink-200 bg-ink-50 p-8 text-center">
            <p className="font-display text-xl text-ink-900">The shelves are being stocked.</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-500">
              Products appear here as soon as vendors publish them. Browse the categories above to see what is live right now.
            </p>
            <Link href="/browse" className="btn-secondary mt-5 inline-flex">
              Browse the marketplace
            </Link>
          </div>
        ) : null}
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featuredProducts.products.map((product) => (
            <Link key={product.id} href={`/s/${product.store_slug}/products/${product.slug}`} className="group card overflow-hidden">
              <div className="relative aspect-square overflow-hidden bg-ink-100">
                <img
                  src={product.images?.[0]?.url ?? "/images/seed/product-jollof.svg"}
                  alt={product.name}
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {product.compare_at_price ? (
                  <span className="absolute left-3 top-3 rounded-full bg-red-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                    Deal
                  </span>
                ) : null}
              </div>
              <div className="p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">{product.store_name}</p>
                <p className="mt-1 line-clamp-1 text-sm font-semibold text-ink-900">{product.name}</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-sm font-bold text-ink-900">{formatMoney(product.price, "NGN", settings.currency_symbol)}</span>
                  {product.compare_at_price ? (
                    <span className="text-xs text-ink-400 line-through">{formatMoney(product.compare_at_price, "NGN", settings.currency_symbol)}</span>
                  ) : null}
                </div>
                {product.kind === "service" ? <p className="mt-1 text-[11px] font-medium text-brand-700">Service · book online</p> : null}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Vendor CTA */}
      <section className="container-page pb-16">
        <div className="relative overflow-hidden rounded-3xl bg-ink-900 px-6 py-12 sm:px-12">
          <div className="absolute -right-20 -top-24 size-80 rounded-full bg-brand-700/40 blur-3xl" aria-hidden />
          <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <h2 className="font-display text-3xl text-white sm:text-4xl">Your business deserves its own address.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-200">
                Register in minutes and get a storefront on your own subdomain — complete with catalogue, orders, payments,
                subscription billing and customer tracking. No code, no hosting bill, no commissions hidden in the fine print.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {!user ? (
                  <>
                    <Link href="/register/customer" className="btn-gold">
                      Create your account first
                    </Link>
                    <Link href="/login" className="btn-secondary border-white/20 bg-transparent text-white hover:bg-white/10">
                      Sign in (Google or email)
                    </Link>
                  </>
                ) : user.role === "customer" ? (
                  <>
                    <Link href="/register" className="btn-gold">Create your storefront</Link>
                    <Link href="/account" className="btn-secondary border-white/20 bg-transparent text-white hover:bg-white/10">My account</Link>
                  </>
                ) : (
                  <Link href={user.role === "vendor" ? "/vendor" : "/admin"} className="btn-gold">
                    Open {user.role === "vendor" ? "Vendor Dashboard" : "Admin Console"}
                  </Link>
                )}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-4 text-white">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <dt className="text-xs text-ink-300">Storefront</dt>
                <dd className="mt-1 text-sm font-semibold">yourbusiness.{process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "ibomvendorshub.com"}</dd>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <dt className="text-xs text-ink-300">Free trial</dt>
                <dd className="mt-1 text-sm font-semibold">{settings.default_trial_days} days</dd>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <dt className="text-xs text-ink-300">Payments</dt>
                <dd className="mt-1 text-sm font-semibold">Paystack &amp; sandbox</dd>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <dt className="text-xs text-ink-300">Support</dt>
                <dd className="mt-1 text-sm font-semibold">Local team</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </div>
  );
}
