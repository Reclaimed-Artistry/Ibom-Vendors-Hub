import { systemDb, type Db } from "@/lib/db";
import type { StoreCategory } from "@/lib/types";

// Workflows come from the listings actually ordered, never from unrelated
// categories that the vendor happens to offer. A mixed order supports the
// preparation/production stages needed by either of its lines.
const STAGE_ORDER = ["placed", "awaiting_payment", "payment_confirmed", "accepted", "awaiting_production", "preparing", "in_production", "in_service", "production_completed", "ready_for_dispatch", "ready_for_pickup", "dispatched", "delivered", "completed"];

export function orderCategory(categories: StoreCategory[]): StoreCategory | null {
  if (!categories.length) return null;
  if (categories.length === 1) return categories[0];
  const stages = new Map(categories.flatMap(category => category.workflow ?? []).map(stage => [stage.key, stage]));
  const rank = (key: string) => { const position = STAGE_ORDER.indexOf(key); return position < 0 ? 8 : position; };
  return {
    ...categories[0], name: "Mixed-category order", slug: "mixed-category-order", features: {},
    workflow: [...stages.values()].sort((a, b) => rank(a.key) - rank(b.key)),
  };
}

/** Correlated projection for orders alias o, with one row per category. */
export const ORDER_CATEGORIES_SQL = `coalesce((
  select jsonb_agg(to_jsonb(oc) order by oc.sort_order, oc.name) from store_categories oc
  where oc.id in (
    select coalesce(oi.marketplace_category_id,p.marketplace_category_id,s.category_id)
      from order_items oi join stores s on s.id = o.store_id
      left join products p on p.id = oi.product_id and p.store_id = s.id where oi.order_id = o.id
  )
), '[]'::jsonb)`;

export async function getOrderCategory(orderId: string, fallbackId?: string | null, db: Db = systemDb) {
  const row = await db.maybeOne<{ categories: StoreCategory[] }>(
    `select ${ORDER_CATEGORIES_SQL} as categories from orders o where o.id = $1`, [orderId],
  );
  if (row?.categories.length) return orderCategory(row.categories);
  return fallbackId ? db.maybeOne<StoreCategory>(`select * from store_categories where id = $1`, [fallbackId]) : null;
}
