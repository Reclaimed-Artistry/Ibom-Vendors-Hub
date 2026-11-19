import type { Metadata } from "next";
import Link from "next/link";
import { SmartSearch } from "@/components/smart-search";
import { Download, Search, ShoppingBag } from "lucide-react";
import { requireActiveVendorContext } from "@/lib/auth";
import { getVendorOrderList } from "@/lib/orders";
import { workflowFor, workflowLabel } from "@/lib/storefront";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { Badge, ButtonLink, EmptyState, PageHeader, Pagination, StatusBadge, Tabs } from "@/components/ui";

export const metadata: Metadata = { title: "Orders · Vendor dashboard" };

const TABS = [
  { key: "all", label: "All" },
  { key: "placed", label: "New" },
  { key: "accepted", label: "Accepted" },
  { key: "in_production", label: "In production" },
  { key: "ready_for_dispatch", label: "Ready" },
  { key: "dispatched", label: "Dispatched" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

export default async function VendorOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const { store, category, categories } = await requireActiveVendorContext();
  const { status = "all", q, page } = await searchParams;
  const result = await getVendorOrderList(store.id, { status, search: q, page: Number(page ?? 1) || 1 });
  const stages = workflowFor(category);
  const buildHref = (target: number) => {
    const query = new URLSearchParams();
    if (status && status !== "all") query.set("status", status);
    if (q) query.set("q", q);
    query.set("page", String(target));
    return `/vendor/orders?${query.toString()}`;
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Orders"
        description="Accept, prepare and fulfil orders. Customers are notified at every step."
        actions={<ButtonLink href="/vendor/orders/export" variant="secondary" size="sm"><Download className="size-3.5" /> Export CSV</ButtonLink>}
      />

      <Tabs links={TABS.map((tab) => ({ href: `/vendor/orders?status=${tab.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`, label: tab.label, active: status === tab.key }))} />

      <form className="card card-pad flex flex-wrap items-end gap-3" action="/vendor/orders">
        <input type="hidden" name="status" value={status} />
        <div className="min-w-0 w-full flex-1 sm:w-auto sm:min-w-56">
          <span className="label block">Search orders</span>
          <SmartSearch
            bare
            action="/vendor/orders"
            placeholder="Reference, customer name, email or phone"
            initialQuery={q ?? ""}
            items={result.orders.map((order) => ({ title: order.reference, subtitle: `${order.customer_name} · ₦${Number(order.total).toLocaleString()}`, href: `/vendor/orders/${order.id}`, searchText: `${order.reference} ${order.customer_name} ${order.customer_email} ${order.customer_phone ?? ""}`, icon: "record" as const }))}
          />
        </div>
        <button type="submit" className="btn btn-secondary">Search</button>
        {q ? <Link href={`/vendor/orders?status=${status}`} className="btn btn-ghost btn-sm">Clear</Link> : null}
      </form>

      {result.orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="size-5" />}
          title={q ? "No orders match your search" : "No orders here yet"}
          description={q ? "Try another reference or customer detail." : "New orders will show up here the moment a customer checks out."}
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Fulfilment</th>
                <th>Status</th>
                <th>Payment</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {result.orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link href={`/vendor/orders/${order.id}`} className="font-semibold text-ink-900 hover:text-brand-700">{order.reference}</Link>
                    <p className="text-xs text-ink-400">{formatDateTime(order.created_at)}</p>
                  </td>
                  <td>
                    <p className="text-sm text-ink-800">{order.customer_name}</p>
                    <p className="text-xs text-ink-400">{order.customer_phone}</p>
                  </td>
                  <td className="text-sm">{order.item_count}</td>
                  <td className="text-sm capitalize">{order.fulfilment_type}</td>
                  <td>
                    <StatusBadge status={order.status} />
                    <p className="mt-1 text-[11px] text-ink-400">{workflowLabel(order.workflow_category ?? category, order.status)}</p>
                  </td>
                  <td>
                    <Badge tone={order.payment_status === "paid" ? "success" : order.payment_status === "failed" ? "danger" : "warning"}>
                      {order.payment_status}
                    </Badge>
                  </td>
                  <td className="text-right font-semibold">{formatMoney(Number(order.total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.totalPages > 1 ? <Pagination page={result.page} totalPages={result.totalPages} buildHref={buildHref} /> : null}

      <p className="text-xs text-ink-400">
        {categories.length > 1 ? "Each order uses the workflow for the categories of the items ordered. Open an order to see its stages." : `Workflow stages for your category: ${stages.map((stage) => stage.label).join(" → ")}`}
      </p>
    </div>
  );
}
