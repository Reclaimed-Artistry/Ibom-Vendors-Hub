import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { listingCanonical, listingPage, publicMetadata, seoDescription, siteUrl } from "@/lib/seo";
import { breadcrumbStructuredData } from "@/lib/structured-data";
import { StoreImage } from "@/components/store-image";
import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { getCategoriesWithCounts, getMarketplaceStores } from "@/lib/storefront";
import { EmptyState, Pagination, Badge } from "@/components/ui";
import { truncate } from "@/lib/utils";

interface StoresParams { category?: string; q?: string; page?: string }

export async function generateMetadata({ searchParams }: { searchParams: Promise<StoresParams> }): Promise<Metadata> {
  const sp = await searchParams;
  const categories = await getCategoriesWithCounts();
  const category = categories.find((item) => item.slug === sp.category);
  const page = listingPage(sp.page);
  return publicMetadata({
    title: `${sp.q ? `Vendor Search: ${seoDescription(sp.q, "", 50)}` : `${category?.name || "Verified Vendors"} in Akwa Ibom`}${page > 1 ? ` — Page ${page}` : ""} · Ibom Vendors Hub`,
    description: `Discover ${category ? `${category.name.toLowerCase()} businesses` : "verified local businesses"} in Uyo and across Akwa Ibom, Nigeria. Visit independent storefronts, explore catalogues and contact vendors.`,
    url: listingCanonical(siteUrl("/stores"), { ...sp, category: category?.slug }),
    index: !sp.q && (!sp.category || Boolean(category && category.store_count > 0)),
  });
}
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StoresPage({
  searchParams,
}: {
  searchParams: Promise<StoresParams>;
}) {
  const sp = await searchParams;
  const page = listingPage(sp.page);
  const limit = 12;
  const [{ stores, total }, categories] = await Promise.all([
    getMarketplaceStores({ categorySlug: sp.category, search: sp.q, limit, offset: (page - 1) * limit }),
    getCategoriesWithCounts(),
  ]);
  const activeCategory = categories.find((category) => category.slug === sp.category);
  const totalPages = Math.max(Math.ceil(total / limit), 1);

  return (
    <div className="container-page py-10">
      {!sp.q ? <JsonLd data={breadcrumbStructuredData([
        { name: "Ibom Vendors Hub", url: siteUrl() },
        { name: "Vendors", url: siteUrl("/stores") },
        ...(activeCategory ? [{ name: activeCategory.name, url: listingCanonical(siteUrl("/stores"), { category: activeCategory.slug }) }] : []),
      ])} /> : null}
      <h1 className="font-display text-3xl text-ink-900">{activeCategory ? `${activeCategory.name} vendors in Akwa Ibom` : "Vendors on Ibom Vendors Hub"}</h1>
      <p className="mt-1 text-sm text-ink-500">{total} independent storefronts, each run by its owner.</p>
      {activeCategory?.description ? <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-600">{activeCategory.description}</p> : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/stores" className={`badge ${!sp.category ? "bg-brand-800 text-white" : "border border-ink-200 bg-white text-ink-600"}`}>All vendors</Link>
        {categories.map((category) => (
          <Link key={category.id} href={`/stores?category=${category.slug}`} className={`badge ${sp.category === category.slug ? "bg-brand-800 text-white" : "border border-ink-200 bg-white text-ink-600"}`}>
            {category.name}
          </Link>
        ))}
      </div>

      {stores.length === 0 ? (
        <div className="mt-8"><EmptyState title="No vendors found" description="Try another category." action={<Link href="/stores" className="btn-primary">Show all</Link>} /></div>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((store) => (
            <Link key={store.id} href={`/s/${store.slug}`} className="group card flex h-80 min-w-0 flex-col overflow-hidden">
              <div className="h-28 shrink-0 overflow-hidden">
                <StoreImage kind="cover" src={store.cover_url} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
              </div>
              <div className="flex min-h-0 flex-1 flex-col p-4">
                <div className="flex items-start gap-3">
                  <StoreImage kind="logo" src={store.logo_url} alt="" className="size-11 shrink-0 rounded-xl border border-ink-100 bg-white object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-900">{store.name}</p>
                    <p className="flex min-w-0 items-center gap-1 truncate text-xs text-ink-400"><MapPin className="size-3" /> {store.city}, {store.state}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold-600"><Star className="size-3 fill-current" /> {store.rating_avg || "New"}</span>
                </div>
                <p className="mt-3 h-12 shrink-0 line-clamp-2 text-sm leading-6 text-ink-500">{store.tagline ?? truncate(store.description, 100)}</p>
                <div className="mt-auto flex min-w-0 items-center gap-2 pt-3 text-[11px] [&>span:first-child]:max-w-[55%] [&>span:first-child]:truncate">
                  <Badge tone="neutral">{store.category_name}</Badge>
                  <span className="text-ink-400">{store.product_count} listings</span>
                  <span className="ml-auto font-semibold text-brand-800">Visit →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} buildHref={(next) => `/stores?${new URLSearchParams({ ...(sp.category ? { category: sp.category } : {}), ...(sp.q ? { q: sp.q } : {}), page: String(next) }).toString()}`} />
    </div>
  );
}
