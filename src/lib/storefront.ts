import { cache } from "react";
import { unstable_cache } from "next/cache";
import { withPublic, systemDb } from "@/lib/db";
import type { Product, Store, StoreCategory } from "@/lib/types";

export interface StoreResolution {
  store: Store | null;
  category: StoreCategory | null;
  live: boolean;
  reason?: string;
}

function offlineReason(store: Store): string | undefined {
  if (store.manual_suspension || store.status === "suspended") {
    return "This storefront is currently suspended by the platform.";
  }
  if (store.status === "expired") return "This storefront is offline: the vendor's subscription has expired.";
  if (store.status === "pending") return "This storefront is awaiting approval and is not public yet.";
  if (store.status === "rejected") return "This storefront was not approved.";
  if (store.visibility !== "public") return "This storefront is unlisted.";
  return undefined;
}

/**
 * Resolve a storefront by subdomain slug through the public RLS context, so a
 * store that is suspended/expired/pending is *invisible to the database*, not
 * merely hidden by the UI.
 *
 * The store and its category come back in one statement (the layout, the page
 * and generateMetadata all need them), and `cache()` makes those three callers
 * share a single lookup per request.
 */
export const resolveStore = cache(async (slug: string): Promise<StoreResolution> => {
  const clean = slug.toLowerCase();

  const visible = await withPublic((db) =>
    db.maybeOne<Store & { category_row: StoreCategory | null }>(
      `select s.*, to_jsonb(c) as category_row
         from stores s
         left join store_categories c on c.id = s.category_id
        where s.slug = $1`,
      [clean],
    ),
  );

  if (visible) return shape(visible, true);

  // The public view returned nothing: find out why (server-side only) so we can
  // show a helpful "store offline" page instead of a 404.
  const exists = await systemDb.maybeOne<Store & { category_row: StoreCategory | null }>(
    `select s.*, to_jsonb(c) as category_row
       from stores s
       left join store_categories c on c.id = s.category_id
      where s.slug = $1`,
    [clean],
  );
  if (!exists) return { store: null, category: null, live: false, reason: undefined };
  return shape(exists, false);
});

function shape(row: Store & { category_row: StoreCategory | null }, live: boolean): StoreResolution {
  const { category_row: category, ...store } = row;
  return {
    store: { ...store, category } as Store,
    category,
    live,
    reason: live ? undefined : offlineReason(store as Store),
  };
}

export interface ProductQuery {
  storeId: string;
  search?: string;
  categoryId?: string;
  sort?: "newest" | "price_asc" | "price_desc" | "popular";
  kind?: "product" | "service";
  limit?: number;
  offset?: number;
  includeUnavailable?: boolean;
}

const PRODUCT_SELECT = `
  select p.*,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'url', i.url, 'alt', i.alt, 'sort_order', i.sort_order)
             order by i.sort_order)
      from product_images i where i.product_id = p.id
    ), '[]'::jsonb) as images,
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', v.id, 'product_id', v.product_id, 'name', v.name, 'sku', v.sku,
               'attributes', v.attributes, 'price', v.price,
               'stock_quantity', v.stock_quantity, 'is_available', v.is_available)
             order by v.sort_order)
      from product_variants v where v.product_id = p.id
    ), '[]'::jsonb) as variants,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'price', a.price, 'is_available', a.is_available)
             order by a.sort_order)
      from product_addons a where a.product_id = p.id and a.is_available
    ), '[]'::jsonb) as addons
  from products p
`;

export async function getStoreProducts(query: ProductQuery): Promise<{ products: Product[]; total: number }> {
  const limit = Math.min(query.limit ?? 24, 60);
  const offset = query.offset ?? 0;
  const order =
    query.sort === "price_asc"
      ? "p.price asc"
      : query.sort === "price_desc"
        ? "p.price desc"
        : query.sort === "popular"
          ? "p.sales_count desc, p.rating_avg desc"
          : "p.is_featured desc, p.created_at desc";

  return withPublic(async (db) => {
    const params: unknown[] = [query.storeId];
    let where = "where p.store_id = $1";
    if (!query.includeUnavailable) where += " and p.is_available = true";
    if (query.search) {
      params.push(`%${query.search}%`);
      where += ` and (p.name ilike $${params.length} or p.description ilike $${params.length} or p.brand ilike $${params.length})`;
    }
    if (query.categoryId) {
      params.push(query.categoryId);
      where += ` and p.category_id = $${params.length}`;
    }
    if (query.kind) {
      params.push(query.kind);
      where += ` and p.kind = $${params.length}`;
    }

    const count = await db.one<{ count: number }>(
      `select count(*)::int as count from products p ${where}`,
      params,
    );
    const rows = await db.query<Product>(
      `${PRODUCT_SELECT} ${where} order by ${order} limit ${limit} offset ${offset}`,
      params,
    );
    return { products: rows, total: count.count };
  });
}

export async function getStoreProduct(storeId: string, productSlug: string): Promise<Product | null> {
  return withPublic(async (db) =>
    db.maybeOne<Product>(`${PRODUCT_SELECT} where p.store_id = $1 and p.slug = $2`, [storeId, productSlug]),
  );
}

export async function getStoreById(storeId: string, actorEmail?: string | null) {
  return withPublic(async (db) => db.maybeOne<Store>(`select * from stores where id = $1`, [storeId]));
}

export interface MarketplaceQuery {
  search?: string;
  categorySlug?: string;
  sort?: "newest" | "price_asc" | "price_desc" | "rating";
  kind?: "product" | "service";
  limit?: number;
  offset?: number;
}

export interface MarketplaceProduct extends Product {
  store_name: string;
  store_slug: string;
  store_logo: string | null;
  store_city: string | null;
  category_name?: string | null;
}

export async function searchMarketplace(query: MarketplaceQuery) {
  const limit = Math.min(query.limit ?? 24, 60);
  const offset = query.offset ?? 0;
  const order =
    query.sort === "price_asc"
      ? "p.price asc"
      : query.sort === "price_desc"
        ? "p.price desc"
        : query.sort === "rating"
          ? "p.rating_avg desc, p.rating_count desc"
          : "p.created_at desc";

  const params: unknown[] = [];
  let where = "where p.is_available = true";
  if (query.search) {
    params.push(`%${query.search}%`);
    where += ` and (p.name ilike $${params.length} or p.description ilike $${params.length}
                or s.name ilike $${params.length} or p.brand ilike $${params.length})`;
  }
  if (query.categorySlug) {
    params.push(query.categorySlug);
    where += ` and c.slug = $${params.length}`;
  }
  if (query.kind) {
    params.push(query.kind);
    where += ` and p.kind = $${params.length}`;
  }

  return withPublic(async (db) => {
    const count = await db.one<{ count: number }>(
      `select count(*)::int as count
         from products p join stores s on s.id = p.store_id
         left join store_categories c on c.id = s.category_id ${where}`,
      params,
    );
    const products = await db.query<MarketplaceProduct>(
      `select p.*, s.name as store_name, s.slug as store_slug, s.logo_url as store_logo,
              s.city as store_city, c.name as category_name,
              coalesce((
                select jsonb_agg(jsonb_build_object('id', i.id, 'url', i.url, 'alt', i.alt, 'sort_order', i.sort_order)
                       order by i.sort_order)
                from product_images i where i.product_id = p.id
              ), '[]'::jsonb) as images
         from products p
         join stores s on s.id = p.store_id
         left join store_categories c on c.id = s.category_id
         ${where}
         order by ${order}
         limit ${limit} offset ${offset}`,
      params,
    );
    return { products, total: count.count };
  });
}

export interface MarketplaceStore extends Store {
  category_name: string | null;
  category_slug: string | null;
  product_count: number;
}

export async function getMarketplaceStores(query: {
  categorySlug?: string;
  search?: string;
  featuredOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ stores: MarketplaceStore[]; total: number }> {
  const limit = Math.min(query.limit ?? 12, 48);
  const offset = query.offset ?? 0;
  const params: unknown[] = [];
  let where = "where true";
  if (query.categorySlug) {
    params.push(query.categorySlug);
    where += ` and c.slug = $${params.length}`;
  }
  if (query.search) {
    params.push(`%${query.search}%`);
    where += ` and (s.name ilike $${params.length} or s.description ilike $${params.length} or s.city ilike $${params.length})`;
  }
  if (query.featuredOnly) where += " and s.is_featured = true";

  return withPublic(async (db) => {
    const count = await db.one<{ count: number }>(
      `select count(*)::int as count from stores s left join store_categories c on c.id = s.category_id ${where}`,
      params,
    );
    const stores = await db.query<MarketplaceStore>(
      `select s.*, c.name as category_name, c.slug as category_slug,
              (select count(*)::int from products p where p.store_id = s.id and p.is_available) as product_count
         from stores s
         left join store_categories c on c.id = s.category_id
         ${where}
         order by s.is_featured desc, s.rating_avg desc, s.created_at desc
         limit ${limit} offset ${offset}`,
      params,
    );
    return { stores, total: count.count };
  });
}

export async function getCategoriesWithCounts() {
  return withPublic(async (db) =>
    db.query<StoreCategory & { store_count: number }>(
      `select c.*,
              (select count(distinct s.id)::int from stores s where s.category_id = c.id) as store_count
         from store_categories c
        where c.is_active = true
        order by c.sort_order, c.name`,
    ),
  );
}

/** Taxonomy changes rarely; cached across requests and invalidated on save. */
export const getStoreCategories = cache(
  unstable_cache(
    async () =>
      withPublic(async (db) =>
        db.query<StoreCategory>(`select * from store_categories where is_active = true order by sort_order, name`),
      ),
    ["store-categories"],
    { tags: ["categories"], revalidate: 300 },
  ),
);

export async function getStoreReviews(storeId: string, limit = 6, productId?: string) {
  return withPublic(async (db) =>
    db.query<{
      id: string;
      rating: number;
      title: string | null;
      comment: string | null;
      customer_name: string;
      created_at: string;
      vendor_response: string | null;
      verified_purchase: boolean;
      product_id: string | null;
      product_name?: string | null;
    }>(
      `select r.id, r.rating, r.title, r.comment, r.customer_name, r.created_at,
              r.vendor_response, r.verified_purchase, r.product_id, p.name as product_name
         from reviews r left join products p on p.id = r.product_id
        where r.store_id = $1 and r.status = 'published'
          and ($3::uuid is null or r.product_id = $3::uuid)
        order by r.created_at desc limit $2`,
      [storeId, Math.min(limit, 30), productId ?? null],
    ),
  );
}

export async function getMarketplaceHighlights() {
  return withPublic(async (db) => {
    const stats = await db.one<{ stores: number; products: number; categories: number }>(
      `select
         (select count(*)::int from stores) as stores,
         (select count(*)::int from products where is_available) as products,
         (select count(*)::int from store_categories where is_active) as categories`,
    );
    const featured = await db.query<MarketplaceStore>(
      `select s.*, c.name as category_name, c.slug as category_slug,
              (select count(*)::int from products p where p.store_id = s.id and p.is_available) as product_count
         from stores s left join store_categories c on c.id = s.category_id
        order by s.is_featured desc, s.rating_avg desc, s.created_at desc
        limit 8`,
    );
    return { stats, featured };
  });
}

/* -------------------------------------------------------------------------- */
/* Operating hours                                                            */
/* -------------------------------------------------------------------------- */
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function lagosNow() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value?.toLowerCase().slice(0, 3) ?? "mon";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { dayKey: (DAY_KEYS as readonly string[]).includes(weekday) ? weekday : "mon", minutes: hour * 60 + minute };
}

export function storeOpenState(hours: Store["operating_hours"]) {
  const entries = Object.entries(hours ?? {}).filter(([, value]) => value && !value.closed && value.open && value.close);
  if (!entries.length) return { known: false, open: true, label: "Open for orders" };
  const { dayKey, minutes } = lagosNow();
  const today = (hours ?? {})[dayKey];
  if (!today || today.closed) return { known: true, open: false, label: "Closed today" };
  const toMinutes = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const openMin = toMinutes(today.open);
  const closeMin = toMinutes(today.close);
  const open = closeMin > openMin ? minutes >= openMin && minutes < closeMin : minutes >= openMin || minutes < closeMin;
  return {
    known: true,
    open,
    label: open ? `Open now · closes ${today.close}` : `Closed · opens ${today.open}`,
  };
}

export function featureEnabled(category: StoreCategory | null | undefined, key: string) {
  if (!category) return true;
  return Boolean((category.features as Record<string, boolean | undefined>)?.[key]);
}

export function workflowFor(category: StoreCategory | null | undefined) {
  const workflow = category?.workflow ?? [];
  if (workflow.length) return workflow;
  return [
    { key: "placed", label: "Order placed" },
    { key: "payment_confirmed", label: "Payment confirmed" },
    { key: "accepted", label: "Accepted" },
    { key: "preparing", label: "Preparing" },
    { key: "dispatched", label: "Dispatched" },
    { key: "delivered", label: "Delivered" },
    { key: "completed", label: "Completed" },
  ];
}

export function workflowLabel(category: StoreCategory | null | undefined, status: string) {
  const found = workflowFor(category).find((stage) => stage.key === status);
  if (found) return found.label;
  const fallback: Record<string, string> = {
    placed: "Order placed",
    awaiting_payment: "Awaiting payment",
    payment_confirmed: "Payment confirmed",
    accepted: "Accepted",
    rejected: "Rejected",
    awaiting_production: "Awaiting production",
    in_production: "In production",
    production_completed: "Production completed",
    ready_for_dispatch: "Ready for dispatch",
    preparing: "Preparing",
    ready_for_pickup: "Ready for pickup",
    dispatched: "Dispatched",
    delivered: "Delivered",
    in_service: "Service in progress",
    completed: "Completed",
    cancelled: "Cancelled",
    refunded: "Refunded",
  };
  return fallback[status] ?? status.replace(/_/g, " ");
}
