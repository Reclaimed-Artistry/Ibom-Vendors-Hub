import { NextResponse } from "next/server";
import { requireActiveVendorContext } from "@/lib/auth";
import { systemDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface OrderItemSummary {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  kind: string;
  name: string;
  variant_name: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
  attributes: Record<string, string>;
}

export async function GET() {
  const ctx = await requireActiveVendorContext();

  const orders = await systemDb.query<{
    id: string;
    reference: string;
    customer_name: string;
    customer_phone: string;
    customer_email: string;
    item_count: number;
    fulfilment_type: string;
    status: string;
    payment_status: string;
    total: number;
    created_at: string;
  }>(
    `select o.id, o.reference, o.customer_name, o.customer_phone, o.customer_email,
            (select count(*)::int from order_items i where i.order_id = o.id) as item_count,
            o.fulfilment_type, o.status, o.payment_status, o.total, o.created_at
       from orders o
      where o.store_id = $1
      order by o.created_at desc
      limit 15`,
    [ctx.store.id]
  );

  const orderIds = orders.map((o) => o.id);
  const itemsByOrder = new Map<string, OrderItemSummary[]>();
  if (orderIds.length > 0) {
    const items = await systemDb.query<OrderItemSummary>(
      `select i.id, i.order_id, i.product_id, i.variant_id, i.kind, i.name, i.variant_name,
              i.unit_price, i.quantity, i.line_total, i.attributes
         from order_items i
        where i.order_id = any($1::uuid[])
        order by i.created_at`,
      [orderIds]
    );
    for (const item of items) {
      const list = itemsByOrder.get(item.order_id) ?? [];
      list.push(item);
      itemsByOrder.set(item.order_id, list);
    }
  }

  const rows = orders.map((order) => ({
    ...order,
    items: itemsByOrder.get(order.id) ?? [],
  }));

  return NextResponse.json({ orders: rows, updatedAt: new Date().toISOString() });
}
