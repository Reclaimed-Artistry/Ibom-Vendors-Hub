import type { Metadata } from "next";
import Link from "next/link";
import { Package } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { formatMoney, formatDate } from "@/lib/utils";
import { ButtonLink, EmptyState, PageHeader, StatusBadge, Tabs } from "@/components/ui";

export const metadata: Metadata = { title: "My orders · Ibom Vendors Hub" };

export default async function AccountOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await requireUser(["customer", "vendor", "admin", "super_admin"]);
  const { filter = "all" } = await searchParams;

  const params: unknown[] = [user.email];
  let where = "lower(o.customer_email) = lower($1)";
  if (filter === "active") where += " and o.status not in ('completed','cancelled','rejected','delivered')";
  if (filter === "completed") where += " and o.status in ('completed','delivered')";
  if (filter === "cancelled") where += " and o.status in ('cancelled','rejected')";

  const rows = await systemDb.query<{
    id: string;
    reference: string;
    status: string;
    payment_status: string;
    total: number;
    created_at: string;
    store_name: string;
    store_slug: string;
    item_count: number;
    first_item: string | null;
  }>(
    `select o.id, o.reference, o.status, o.payment_status, o.total, o.created_at,
            s.name as store_name, s.slug as store_slug,
            (select count(*)::int from order_items i where i.order_id = o.id) as item_count,
            (select name from order_items i where i.order_id = o.id order by id limit 1) as first_item
       from orders o join stores s on s.id = o.store_id
      where ${where} order by o.created_at desc limit 60`,
    params,
  );

  return (
    <div className="space-y-4">
      <PageHeader title="My orders" description="Every order, with live status and receipts." actions={<ButtonLink href="/browse" variant="secondary" size="sm">Shop again</ButtonLink>} />
      <Tabs
        links={[
          { href: "/account/orders", label: "All", active: filter === "all" },
          { href: "/account/orders?filter=active", label: "Active", active: filter === "active" },
          { href: "/account/orders?filter=completed", label: "Completed", active: filter === "completed" },
          { href: "/account/orders?filter=cancelled", label: "Cancelled", active: filter === "cancelled" },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState icon={<Package className="size-5" />} title="No orders in this view" description="Orders you place on any storefront appear here." action={<ButtonLink href="/browse">Browse stores</ButtonLink>} />
      ) : (
        <div className="space-y-2">
          {rows.map((order) => (
            <Link key={order.id} href={`/account/orders/${order.id}`} className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:border-brand-300">
              <div className="min-w-0">
                <p className="font-semibold text-ink-900">{order.reference}</p>
                <p className="text-xs text-ink-500">
                  {order.store_name} · {order.first_item ?? "Order"}{order.item_count > 1 ? ` +${order.item_count - 1} more` : ""} · {formatDate(order.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={order.status} />
                <span className="text-sm font-semibold">{formatMoney(Number(order.total))}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
