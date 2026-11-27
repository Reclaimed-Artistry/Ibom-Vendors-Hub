import { NextResponse } from "next/server";
import { requireActiveVendorContext } from "@/lib/auth";
import { systemDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const ctx = await requireActiveVendorContext();
  const rows = await systemDb.query<{
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
    `select o.reference, o.customer_name, o.customer_phone, o.customer_email,
            (select count(*)::int from order_items i where i.order_id = o.id) as item_count,
            o.fulfilment_type, o.status, o.payment_status, o.total, o.created_at
       from orders o
      where o.store_id = $1
      order by o.created_at desc
      limit 15`,
    [ctx.store.id]
  );

  return NextResponse.json({ orders: rows, updatedAt: new Date().toISOString() });
}
