import { NextResponse } from "next/server";
import { systemDb } from "@/lib/db";
import { customerSearchPattern } from "@/lib/customer-search";

export const dynamic = "force-dynamic";

/**
 * Live suggestions for the marketplace search: matching products, stores and
 * categories as the visitor types. Public and read-only.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ products: [], stores: [], categories: [] });

  const pattern = customerSearchPattern(q);
  const [products, stores, categories] = await Promise.all([
    systemDb.query<{
      name: string;
      slug: string;
      price: number | null;
      store_name: string;
      store_slug: string;
      kind: string;
    }>(
      `select p.name, p.slug, p.price, s.name as store_name, s.slug as store_slug, p.kind
         from products p
         join stores s on s.id = p.store_id
        where p.is_available and store_is_live(s.id)
          and (lower(p.name) like lower($1) or lower(p.description) like lower($1))
        order by p.created_at desc
        limit 6`,
      [pattern],
    ),
    systemDb.query<{ name: string; slug: string; city: string | null; category_name: string | null }>(
      `select s.name, s.slug, s.city,
              (select string_agg(bc.name, ' · ' order by (bc.id = s.category_id) desc, bc.sort_order)
                 from store_category_assignments a join store_categories bc on bc.id = a.category_id
                where a.store_id = s.id) as category_name
         from stores s
        where store_is_live(s.id) and (lower(s.name) like lower($1) or lower(s.tagline) like lower($1))
        order by s.name
        limit 4`,
      [pattern],
    ),
    systemDb.query<{ name: string; slug: string }>(
      `select name, slug from store_categories where is_active and lower(name) like lower($1) order by name limit 4`,
      [pattern],
    ),
  ]);

  return NextResponse.json({ products, stores, categories });
}
