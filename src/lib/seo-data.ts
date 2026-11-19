import type { MetadataRoute } from "next";
import { withPublic } from "@/lib/db";
import { crawlerContext, listingCanonical, siteUrl, storeUrl } from "@/lib/seo";

interface SitemapStore { id: string; slug: string; updated_at: string | Date }
interface SitemapProduct { slug: string; updated_at: string | Date }

/** One sitemap per origin: never put unverified cross-host URLs in an XML file. */
export async function sitemapForHost(host: string | null): Promise<MetadataRoute.Sitemap> {
  const context = crawlerContext(host);
  if (!context.indexable) return [];

  return withPublic(async (db) => {
    if (context.slug) {
      const store = await db.maybeOne<SitemapStore>(
        `select id, slug, updated_at from stores where slug = $1 and store_is_live(id)`,
        [context.slug],
      );
      if (!store) return [];
      const products = await db.query<SitemapProduct>(
        `select p.slug, greatest(p.updated_at, s.updated_at) as updated_at
           from products p join stores s on s.id = p.store_id
          where p.store_id = $1 and p.is_available and store_is_live(s.id)
          order by p.slug`,
        [store.id],
      );
      return [
        { url: storeUrl(store.slug), lastModified: store.updated_at },
        { url: storeUrl(store.slug, "/products") },
        ...products.map((product) => ({
          url: storeUrl(store.slug, `/products/${encodeURIComponent(product.slug)}`),
          lastModified: product.updated_at,
        })),
      ];
    }

    const categories = await db.query<{ slug: string; product_count: number; store_count: number }>(
      `select c.slug,
              (select count(*)::int from store_category_assignments a join stores s on s.id = a.store_id where a.category_id = c.id and store_is_live(s.id)) as store_count,
              (select count(*)::int from products p join stores s on s.id = p.store_id
                where coalesce(p.marketplace_category_id, s.category_id) = c.id and p.is_available and store_is_live(s.id)) as product_count
         from store_categories c where c.is_active order by c.sort_order, c.slug`,
    );
    const totals = await db.one<{ product_count: number; store_count: number }>(
      `select (select count(*)::int from stores s where store_is_live(s.id)) as store_count,
              (select count(*)::int from products p join stores s on s.id = p.store_id
                where p.is_available and store_is_live(s.id)) as product_count`,
    );
    const entries: MetadataRoute.Sitemap = ["/", "/browse", "/stores", "/about", "/contact", "/sell", "/terms", "/privacy"]
      .map((path) => ({ url: siteUrl(path) }));
    const addListingPages = (path: string, total: number, perPage: number, category?: string) => {
      for (let page = category ? 1 : 2; page <= Math.ceil(total / perPage); page += 1) {
        entries.push({ url: listingCanonical(siteUrl(path), { category, page: String(page) }) });
      }
    };
    addListingPages("/browse", totals.product_count, 24);
    addListingPages("/stores", totals.store_count, 12);
    for (const category of categories) {
      // Empty filters are not search landing pages. They enter automatically
      // when approved vendors/listings are published, and leave when offline.
      addListingPages("/browse", category.product_count, 24, category.slug);
      addListingPages("/stores", category.store_count, 12, category.slug);
    }
    return entries;
  });
}
