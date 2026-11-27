import type { Metadata } from "next";
import Link from "next/link";
import { SmartSearch } from "@/components/smart-search";
import { Download } from "lucide-react";
import { requireActiveVendorContext } from "@/lib/auth";
import { getVendorOrderList } from "@/lib/orders";
import { workflowFor } from "@/lib/storefront";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { Badge, ButtonLink, EmptyState, PageHeader, Pagination, StatusBadge, Tabs } from "@/components/ui";
import { RealtimeOrders } from "@/components/realtime-orders";

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
  const result = await getVendorOrderList(store.id, {
    status,
    search: q,
    page: Number(page ?? 1) || 1,
  });
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
        description="Accept, prepare and fulfil orders. Customers are notified at every step. (Live updates every 0.5s)"
        actions={
          <ButtonLink href="/vendor/orders/export" variant="secondary" size="sm">
            <Download className="size-3.5" /> Export CSV
          </ButtonLink>
        }
      />

      <Tabs
        links={TABS.map((tab) => ({
          href: `/vendor/orders?status=${tab.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
          label: tab.label,
          active: status === tab.key,
        }))}
      />

      <form
        className="card card-pad flex flex-wrap items-end gap-3"
        action="/vendor/orders"
      >
        <input type="hidden" name="status" value={status} />
        <div className="min-w-0 w-full flex-1 sm:w-auto sm:min-w-56">
          <span className="label block">Search orders</span>
          <SmartSearch
            bare
            action="/vendor/orders"
            placeholder="Reference, customer name, email or phone"
            initialQuery={q ?? ""}
            items={result.orders.map((order) => ({
              title: order.reference,
              subtitle: `${order.customer_name} · ₦${Number(order.total).toLocaleString()}`,
              href: `/vendor/orders/${order.id}`,
              searchText: `${order.reference} ${order.customer_name} ${order.customer_email} ${order.customer_phone ?? ""}`,
              icon: "record",
            }))}
          />
        </div>
        <button type="submit" className="btn btn-secondary">
          Search
        </button>
        {q ? (
          <Link href={`/vendor/orders?status=${status}`} className="btn btn-ghost btn-sm">
            Clear
          </Link>
        ) : null}
      </form>

      <RealtimeOrders
        initialOrders={result.orders}
        statusFilter={status}
        searchQuery={q ?? ""}
      />

      {result.totalPages > 1 ? (
        <Pagination page={result.page} totalPages={result.totalPages} buildHref={buildHref} />
      ) : null}

      <p className="text-xs text-ink-400">
        {categories.length > 1
          ? "Each order uses the workflow for the categories of the items ordered. Open an order to see its stages."
          : `Workflow stages for your category: ${stages.map((stage) => stage.label).join(" → ")}`}
      </p>
    </div>
  );
}
