import type { Db } from "@/lib/db";
import type { StoreCategory } from "@/lib/types";
import { categorySlugs } from "@/lib/category-policy";

export async function getBusinessCategories(db: Db, storeId: string) {
  return db.query<StoreCategory>(
    `select c.* from store_category_assignments a
       join store_categories c on c.id = a.category_id
       join stores s on s.id = a.store_id
      where a.store_id = $1
      order by (c.id = s.category_id) desc, c.sort_order, c.name`,
    [storeId],
  );
}

export async function validateBusinessCategories(db: Db, primarySlug: string, additional: string[] = [], storeId?: string) {
  const slugs = categorySlugs(primarySlug, additional);
  if (!primarySlug || slugs.length === 0 || slugs.length > 60) throw new Error("Choose at least one valid business category and a primary category.");
  const rows = await db.query<StoreCategory>(
    `select c.* from store_categories c where c.slug = any($1::text[]) and (c.is_active
      or exists (select 1 from store_category_assignments a where a.store_id = $2::uuid and a.category_id = c.id))`, [slugs, storeId ?? null],
  );
  if (rows.length !== slugs.length) throw new Error("One of the business categories is invalid or no longer available. Choose from the listed categories.");
  const primary = rows.find((row) => row.slug === primarySlug);
  if (!primary) throw new Error("Choose a valid primary business category.");
  return { primary, categories: slugs.map((slug) => rows.find((row) => row.slug === slug)!) };
}

/** Caller supplies an authenticated, store-scoped transaction. */
export async function saveBusinessCategories(db: Db, storeId: string, primarySlug: string, additional: string[]) {
  const store = await db.one<{ category_id: string | null }>(`select category_id from stores where id = $1 for update`, [storeId]);
  const selected = await validateBusinessCategories(db, primarySlug, additional, storeId);
  if (!selected.primary.is_active && selected.primary.id !== store.category_id) throw new Error("Choose an active primary business category.");
  const ids = selected.categories.map((category) => category.id);
  const used = await db.maybeOne<{ name: string }>(
    `select c.name from products p join store_categories c on c.id = p.marketplace_category_id
      where p.store_id = $1 and not (p.marketplace_category_id = any($2::uuid[])) limit 1`, [storeId, ids],
  );
  if (used) throw new Error(`You still have listings in ${used.name}. Move those listings to another marketplace category before removing it from your business categories.`);
  await db.execute(
    `insert into store_category_assignments(store_id,category_id)
     select $1, id from unnest($2::uuid[]) as chosen(id)
      where not exists (select 1 from store_category_assignments a where a.store_id = $1 and a.category_id = chosen.id)
     on conflict do nothing`, [storeId, ids],
  );
  await db.execute(`update stores set category_id = $2 where id = $1`, [storeId, selected.primary.id]);
  await db.execute(`delete from store_category_assignments where store_id = $1 and not (category_id = any($2::uuid[]))`, [storeId, ids]);
  return selected;
}

/** Choosing a category on a listing also adds that business line to the store. */
export async function addProductBusinessCategory(db: Db, storeId: string, categoryId: string, existingProductId?: string | null) {
  const store = await db.one<{ category_id: string | null }>(`select category_id from stores where id = $1 for update`, [storeId]);
  const category = await db.maybeOne<StoreCategory>(
    `select c.* from store_categories c where c.id = $1 and (c.is_active or exists (
      select 1 from products p where p.store_id = $2 and p.id = $3::uuid and p.marketplace_category_id = c.id
    ))`, [categoryId, storeId, existingProductId ?? null],
  );
  if (!category) throw new Error("Choose a valid marketplace category for this listing.");
  await db.execute(`insert into store_category_assignments(store_id,category_id) select $1,$2
    where not exists (select 1 from store_category_assignments where store_id=$1 and category_id=$2) on conflict do nothing`, [storeId, category.id]);
  if (!store.category_id) await db.execute(`update stores set category_id = $2 where id = $1`, [storeId, category.id]);
  return category;
}

/** SQL projection for a single store alias s; no join multiplication. */
export const BUSINESS_CATEGORIES_SQL = `coalesce((
  select jsonb_agg(to_jsonb(bc) order by (bc.id = s.category_id) desc, bc.sort_order, bc.name)
    from store_category_assignments ba join store_categories bc on bc.id = ba.category_id
   where ba.store_id = s.id
), '[]'::jsonb)`;

export const BUSINESS_CATEGORY_NAMES_SQL = `(select string_agg(bc.name, ' · ' order by (bc.id = s.category_id) desc, bc.sort_order, bc.name)
  from store_category_assignments ba join store_categories bc on bc.id = ba.category_id
  where ba.store_id = s.id)`;
