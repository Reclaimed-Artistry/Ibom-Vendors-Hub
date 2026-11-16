import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { getCategoriesWithCounts, searchMarketplace } from "@/lib/storefront";
import { getSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/utils";
import { Badge, EmptyState, Pagination } from "@/components/ui";

export const metadata = { title: "Browse the marketplace" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; sort?: string; kind?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(Number(sp.page ?? "1") || 1, 1);
  const limit = 24;
  const [{ products, total }, categories, settings] = await Promise.all([
    searchMarketplace({
      search: sp.q,
      categorySlug: sp.category,
      sort: (sp.sort as "newest" | "price_asc" | "price_desc" | "rating") ?? "newest",
      kind: sp.kind === "service" ? "service" : sp.kind === "product" ? "product" : undefined,
      limit,
      offset: (page - 1) * limit,
    }),
    getCategoriesWithCounts(),
    getSettings(),
  ]);

  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const buildHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.category) params.set("category", sp.category);
    if (sp.sort) params.set("sort", sp.sort);
    if (sp.kind) params.set("kind", sp.kind);
    params.set("page", String(nextPage));
    return `/browse?${params.toString()}`;
  };

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink-900">
            {sp.q ? `Results for “${sp.q}”` : sp.category ? categories.find((c) => c.slug === sp.category)?.name ?? "Browse" : "Browse the marketplace"}
          </h1>
          <p className="mt-1 text-sm text-ink-500">{total} listing{total === 1 ? "" : "s"} from verified Akwa Ibom vendors</p>
        </div>
        <form action="/browse" className="flex w-full max-w-md items-center gap-2">
          {sp.category ? <input type="hidden" name="category" value={sp.category} /> : null}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <input name="q" defaultValue={sp.q} placeholder="Search products or services" className="input pl-10" aria-label="Search" />
          </div>
          <button className="btn-primary">Search</button>
        </form>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Link href="/browse" className={`badge ${!sp.category ? "bg-brand-800 text-white" : "bg-white text-ink-600 border border-ink-200"}`}>
          All categories
        </Link>
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/browse?category=${category.slug}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`}
            className={`badge ${sp.category === category.slug ? "bg-brand-800 text-white" : "bg-white text-ink-600 border border-ink-200"}`}
          >
            {category.name}
            <span className="opacity-60">{category.store_count}</span>
          </Link>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-100 bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-ink-500">
          <SlidersHorizontal className="size-4" /> Refine
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          {[
            { key: "newest", label: "Newest" },
            { key: "rating", label: "Top rated" },
            { key: "price_asc", label: "Price: low to high" },
            { key: "price_desc", label: "Price: high to low" },
          ].map((option) => {
            const params = new URLSearchParams();
            if (sp.q) params.set("q", sp.q);
            if (sp.category) params.set("category", sp.category);
            if (sp.kind) params.set("kind", sp.kind);
            params.set("sort", option.key);
            const active = (sp.sort ?? "newest") === option.key;
            return (
              <Link key={option.key} href={`/browse?${params.toString()}`} className={active ? "rounded-lg bg-ink-900 px-2.5 py-1.5 text-white" : "rounded-lg px-2.5 py-1.5 text-ink-500 hover:bg-ink-100"}>
                {option.label}
              </Link>
            );
          })}
          <span className="mx-1 hidden h-5 w-px bg-ink-200 sm:block" />
          {[
            { key: "", label: "Everything" },
            { key: "product", label: "Products" },
            { key: "service", label: "Services" },
          ].map((option) => {
            const params = new URLSearchParams();
            if (sp.q) params.set("q", sp.q);
            if (sp.category) params.set("category", sp.category);
            if (sp.sort) params.set("sort", sp.sort);
            if (option.key) params.set("kind", option.key);
            const active = (sp.kind ?? "") === option.key;
            return (
              <Link key={option.label} href={`/browse?${params.toString()}`} className={active ? "rounded-lg bg-ink-900 px-2.5 py-1.5 text-white" : "rounded-lg px-2.5 py-1.5 text-ink-500 hover:bg-ink-100"}>
                {option.label}
              </Link>
            );
          })}
        </div>
      </div>

      {products.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Nothing matched that search"
            description="Try a different keyword, another category, or browse every vendor on the platform."
            action={<Link href="/browse" className="btn-primary">Clear filters</Link>}
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <Link key={product.id} href={`/s/${product.store_slug}/products/${product.slug}`} className="group card overflow-hidden">
              <div className="relative aspect-square overflow-hidden bg-ink-100">
                <img src={product.images?.[0]?.url ?? "/images/seed/product-jollof.svg"} alt={product.name} className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                {!product.is_available ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs font-bold uppercase tracking-wide text-ink-700">Unavailable</span>
                ) : null}
                {product.made_to_order ? (
                  <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-800">Made to order</span>
                ) : null}
              </div>
              <div className="p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">{product.store_name}</p>
                <p className="mt-1 line-clamp-1 text-sm font-semibold text-ink-900">{product.name}</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-sm font-bold text-ink-900">
                    {product.pricing_type === "quotation" ? "Request quote" : `${product.pricing_type === "from" ? "From " : ""}${formatMoney(product.price, product.currency, settings.currency_symbol)}`}
                  </span>
                  {product.compare_at_price ? (
                    <span className="text-xs text-ink-400 line-through">{formatMoney(product.compare_at_price, product.currency, settings.currency_symbol)}</span>
                  ) : null}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  {product.kind === "service" ? <Badge tone="info">Service</Badge> : null}
                  {product.condition ? <Badge tone="neutral">{product.condition}</Badge> : null}
                  {product.rating_count > 0 ? <span className="text-[11px] text-gold-600">★ {product.rating_avg} ({product.rating_count})</span> : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} buildHref={buildHref} />
    </div>
  );
}
