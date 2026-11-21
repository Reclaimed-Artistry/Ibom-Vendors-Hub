import { ListingMedia } from "@/components/listing-media";
import type { Metadata } from "next";
import Link from "next/link";
import { SmartSearch } from "@/components/smart-search";
import { ImageIcon, Package, Plus, Search } from "lucide-react";
import { requireActiveVendorContext } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { Alert, Badge, ButtonLink, EmptyState, PageHeader, Pagination } from "@/components/ui";
import { ConfirmSubmit } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit-button";
import { deleteProductAction, toggleProductAvailabilityAction } from "@/app/actions/vendor";

export const metadata: Metadata = { title: "Products · Vendor dashboard" };

const PAGE_SIZE = 12;

export default async function VendorProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; category?: string; deleted?: string }>;
}) {
  const { store, category: storeCategory, categories: businessCategories } = await requireActiveVendorContext();
  const propertyAgency = businessCategories.length === 1 && storeCategory?.slug === "house-agents-realtors";
  const { q, status, page: pageParam, category, deleted } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? 1) || 1);

  const filters: string[] = ["p.store_id = $1"];
  const params: unknown[] = [store.id];
  if (q) {
    params.push(`%${q}%`);
    filters.push(`(p.name ilike $${params.length} or p.sku ilike $${params.length} or p.description ilike $${params.length})`);
  }
  if (status === "available") filters.push("p.is_available");
  if (status === "unavailable") filters.push("not p.is_available");
  if (status === "low") filters.push("p.track_stock and p.stock_quantity <= 5");
  if (category) {
    params.push(category);
    filters.push(`p.category_id = $${params.length}`);
  }
  const where = filters.join(" and ");

  const [rows, count, categories] = await Promise.all([
    systemDb.query<{
      id: string;
      name: string;
      price: number;
      is_available: boolean;
      stock_quantity: number;
      track_stock: boolean;
      kind: string;
      category_name: string | null;
      marketplace_category_name: string | null;
      image_url: string | null;
      sales_count: number;
      views_count: number;
    }>(
      `select p.id, p.name, p.price, p.is_available, p.stock_quantity, p.track_stock, p.kind, p.sales_count, p.views_count,
              c.name as category_name, mc.name as marketplace_category_name,
              (select url from product_images where product_id = p.id order by sort_order limit 1) as image_url
         from products p left join product_categories c on c.id = p.category_id
         left join stores s on s.id = p.store_id
         left join store_categories mc on mc.id = coalesce(p.marketplace_category_id, s.category_id)
        where ${where}
        order by p.updated_at desc
        limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`,
      params,
    ),
    systemDb.one<{ count: number }>(`select count(*)::int as count from products p where ${where}`, params),
    systemDb.query<{ id: string; name: string }>(
      `select id, name from product_categories where store_id = $1 order by sort_order, name`,
      [store.id],
    ),
  ]);

  const totalPages = Math.max(1, Math.ceil(count.count / PAGE_SIZE));
  const buildHref = (target: number) => {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    if (status) query.set("status", status);
    if (category) query.set("category", category);
    query.set("page", String(target));
    return `/vendor/products?${query.toString()}`;
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={propertyAgency ? "Properties for rent & sale" : "Products & services"}
        description="What customers see on your storefront, with pricing, stock and category-specific details."
        actions={<ButtonLink href="/vendor/products/new"><Plus className="size-4" /> {propertyAgency ? "Add property" : "Add product"}</ButtonLink>}
      />

      {deleted ? (
        <Alert tone="success" title="Product deleted">
          The product and its images have been permanently removed from your storefront and the marketplace.
        </Alert>
      ) : null}

      <form className="card card-pad flex flex-wrap items-end gap-3" action="/vendor/products">
        <div className="min-w-0 w-full flex-1 sm:w-auto sm:min-w-56">
          <span className="label block">Search</span>
          <SmartSearch
            bare
            action="/vendor/products"
            placeholder="Name, SKU or description"
            initialQuery={q ?? ""}
            items={rows.map((product) => ({ title: product.name, subtitle: `₦${Number(product.price).toLocaleString()}${product.category_name ? ` · ${product.category_name}` : ""}`, href: `/vendor/products/${product.id}`, searchText: product.name, icon: "product" as const }))}
          />
        </div>
        <label className="w-40">
          <span className="label">Status</span>
          <select name="status" defaultValue={status ?? ""} className="select">
            <option value="">All</option>
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
            <option value="low">Low stock</option>
          </select>
        </label>
        <label className="w-44">
          <span className="label">Catalogue section</span>
          <select name="category" defaultValue={category ?? ""} className="select">
            <option value="">All sections</option>
            {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <button className="btn btn-secondary" type="submit">Filter</button>
        {q || status || category ? <Link href="/vendor/products" className="btn btn-ghost btn-sm">Reset</Link> : null}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Package className="size-5" />}
          title={q || status || category ? "No products match these filters" : "No products yet"}
          description={q || status || category ? "Try a different search or reset the filters." : "Add your first product so customers can start ordering."}
          action={<ButtonLink href="/vendor/products/new">Add product</ButtonLink>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((product) => (
            <Link key={product.id} href={`/vendor/products/${product.id}`} className="card card-pad flex flex-col gap-3 hover:bg-ink-50 transition-colors group">
              <div className="aspect-[4/3] rounded-xl bg-ink-100 overflow-hidden flex shrink-0">
                {product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <ListingMedia autoPlayInView={false} src={product.image_url} alt={product.name} className="size-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="size-full flex items-center justify-center text-ink-300">
                    <ImageIcon className="size-6" />
                  </div>
                )}
                {!product.is_available ? (
                  <span className="absolute left-3 top-3 rounded-full bg-red-900 px-2 py-1 text-[10px] font-bold text-white">Hidden</span>
                ) : null}
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <h3 className="font-semibold text-ink-900 line-clamp-2 group-hover:text-brand-700">{product.name}</h3>
                <p className="text-xs text-ink-400">{product.kind === "service" ? "Service" : "Product"}</p>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-ink-900">{formatMoney(Number(product.price))}</p>
                    {product.track_stock ? (
                      <Badge tone={product.stock_quantity === 0 ? "danger" : product.stock_quantity <= 5 ? "warning" : "neutral"}>
                        {product.stock_quantity} in stock
                      </Badge>
                    ) : (
                      <span className="text-xs text-ink-400">Not tracked</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Link href={`/vendor/products/${product.id}`} className="btn btn-ghost btn-sm">
                      Edit
                    </Link>
                    <form action={toggleProductAvailabilityAction}>
                      <input type="hidden" name="productId" value={product.id} />
                      <input type="hidden" name="available" value={product.is_available ? "false" : "true"} />
                      <SubmitButton className="btn-ghost btn-sm" pendingLabel="…">{product.is_available ? "Hide" : "Show"}</SubmitButton>
                    </form>
                    <form action={deleteProductAction}>
                      <input type="hidden" name="productId" value={product.id} />
                      <ConfirmSubmit
                        message={`Delete “${product.name}”? Existing orders keep their history.`}
                        className="btn btn-danger btn-sm"
                      >
                        Delete
                      </ConfirmSubmit>
                    </form>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} buildHref={buildHref} /> : null}

      <Alert tone="info" title="Products are preserved">
        If your subscription lapses, your products, images and order history stay intact. Your storefront simply goes offline until you renew.
      </Alert>
    </div>
  );
}
