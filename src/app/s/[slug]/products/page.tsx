import Link from "next/link";
import { notFound } from "next/navigation";
import { Search } from "lucide-react";
import { getStoreProducts, resolveStore } from "@/lib/storefront";
import { storeBase } from "@/lib/storefront-base";
import { withPublic } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatMoney, truncate } from "@/lib/utils";
import { Badge, EmptyState, Pagination } from "@/components/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StoreProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; category?: string; sort?: string; page?: string }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { store, category } = await resolveStore(slug);
  if (!store) notFound();
  const base = await storeBase(slug);
  const settings = await getSettings();
  const page = Math.max(Number(sp.page ?? "1") || 1, 1);
  const limit = 24;

  const [{ products, total }, groups] = await Promise.all([
    getStoreProducts({
      storeId: store.id,
      search: sp.q,
      categoryId: sp.category,
      sort: (sp.sort as "newest" | "price_asc" | "price_desc" | "popular") ?? "newest",
      limit,
      offset: (page - 1) * limit,
      includeUnavailable: true,
    }),
    withPublic(async (db) =>
      db.query<{ id: string; name: string }>(
        `select id, name from product_categories where store_id = $1 and is_active order by sort_order, name`,
        [store.id],
      ),
    ),
  ]);
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const features = (category?.features ?? {}) as Record<string, boolean>;

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-900">
            {features.propertyListings ? "Properties" : features.serviceBooking && !features.cart ? "Services" : "Catalogue"}
          </h1>
          <p className="mt-1 text-sm text-ink-500">{total} live listing{total === 1 ? "" : "s"} from {store.name}</p>
        </div>
        <form className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <input name="q" defaultValue={sp.q} placeholder="Search this store" className="input pl-10" />
          </div>
          <button className="btn-secondary">Search</button>
        </form>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link href={`${base}/products`} className={`badge ${!sp.category ? "bg-brand-800 text-white" : "border border-ink-200 bg-white text-ink-600"}`}>All</Link>
        {groups.map((group) => (
          <Link key={group.id} href={`${base}/products?category=${group.id}`} className={`badge ${sp.category === group.id ? "bg-brand-800 text-white" : "border border-ink-200 bg-white text-ink-600"}`}>
            {group.name}
          </Link>
        ))}
        <span className="mx-1 h-5 w-px bg-ink-200" />
        {[
          { key: "newest", label: "Newest" },
          { key: "price_asc", label: "Price ↑" },
          { key: "price_desc", label: "Price ↓" },
          { key: "popular", label: "Popular" },
        ].map((option) => (
          <Link
            key={option.key}
            href={`${base}/products?${new URLSearchParams({ ...(sp.category ? { category: sp.category } : {}), ...(sp.q ? { q: sp.q } : {}), sort: option.key }).toString()}`}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${(sp.sort ?? "newest") === option.key ? "bg-ink-900 text-white" : "text-ink-500 hover:bg-ink-100"}`}
          >
            {option.label}
          </Link>
        ))}
      </div>

      {products.length === 0 ? (
        <div className="mt-8"><EmptyState title="No listings yet" description={`${store.name} has not published anything in this category.`} action={<Link href={base || "/"} className="btn-primary">Back to storefront</Link>} /></div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Link key={product.id} href={!features.propertyListings && product.kind === "service" && product.is_available ? `${base}/book/${product.slug}` : `${base}/products/${product.slug}`} className="group card overflow-hidden">
              <div className="relative aspect-[4/3] overflow-hidden bg-ink-100">
                <img src={product.images?.[0]?.url ?? "/images/seed/product-jollof.svg"} alt={product.name} className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                {!product.is_available ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs font-bold uppercase tracking-wide text-ink-700">Unavailable</span>
                ) : null}
                {product.made_to_order ? (
                  <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-800">Made to order</span>
                ) : null}
              </div>
              <div className="p-4">
                <p className="line-clamp-1 text-sm font-semibold text-ink-900">{product.name}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-500">{truncate(product.short_description ?? product.description, 90)}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-ink-900">
                    {product.pricing_type === "quotation" ? "Request quote" : `${product.pricing_type === "from" ? "From " : ""}${formatMoney(product.price, product.currency, settings.currency_symbol)}`}
                  </span>
                  <div className="flex items-center gap-1">
                    {product.kind === "service" ? <span className="rounded-lg bg-brand-800 px-3 py-2 text-xs font-semibold text-white">{features.propertyListings ? "View property →" : "Book now →"}</span> : null}
                    {product.track_stock && product.stock_quantity <= 0 ? <Badge tone="danger">Out of stock</Badge> : null}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        buildHref={(next) =>
          `${base}/products?${new URLSearchParams({ ...(sp.category ? { category: sp.category } : {}), ...(sp.q ? { q: sp.q } : {}), ...(sp.sort ? { sort: sp.sort } : {}), page: String(next) }).toString()}`
        }
      />
    </div>
  );
}
