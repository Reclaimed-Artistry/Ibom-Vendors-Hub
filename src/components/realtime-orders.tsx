"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePoll } from "@/lib/use-poll";
import { Badge, EmptyState, StatusBadge } from "@/components/ui";
import { ShoppingBag } from "lucide-react";
import { formatMoney, formatDateTime } from "@/lib/utils";

interface PollOrderItem {
  id: string;
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

interface PollOrder {
  id: string;
  reference: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  item_count: number;
  items: PollOrderItem[];
  fulfilment_type: string;
  status: string;
  payment_status: string;
  total: number;
  created_at: string;
}

interface PollOrdersResponse {
  orders: PollOrder[];
  updatedAt: string;
}

interface RealtimeOrdersProps {
  initialOrders: PollOrder[];
  statusFilter: string;
  searchQuery: string;
}

export function RealtimeOrders({
  initialOrders,
  statusFilter,
  searchQuery,
}: RealtimeOrdersProps) {
  const [orders, setOrders] = useState<PollOrder[]>(initialOrders);

  const { data, error, refetch } = usePoll<PollOrdersResponse>(
    async () => {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (searchQuery) params.set("q", searchQuery);
      const res = await fetch(`/api/poll/orders?${params.toString()}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error("Failed to fetch orders");
      return res.json();
    },
    500,
    { orders: initialOrders, updatedAt: new Date().toISOString() }
  );

  // Merge new orders into local state, preserving order by created_at desc
  useEffect(() => {
    if (data?.orders) {
      setOrders(data.orders);
    }
  }, [data]);

  const buildHref = (target: number) => {
    const query = new URLSearchParams();
    if (statusFilter && statusFilter !== "all") query.set("status", statusFilter);
    if (searchQuery) query.set("q", searchQuery);
    query.set("page", String(target));
    return `/vendor/orders?${query.toString()}`;
  };

  if (orders.length === 0) {
    return (
      <div className="table-wrap">
        <EmptyState
          icon={<ShoppingBag className="size-5" />}
          title={searchQuery ? "No orders match your search" : "No orders here yet"}
          description={
            searchQuery
              ? "Try another reference or customer detail."
              : "New orders will show up here the moment a customer checks out."
          }
        />
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Items ordered</th>
            <th>Fulfilment</th>
            <th>Status</th>
            <th>Payment</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>
                <Link
                  href={`/vendor/orders/${order.id}`}
                  className="font-semibold text-ink-900 hover:text-brand-700"
                >
                  {order.reference}
                </Link>
                <p className="text-xs text-ink-400">
                  {formatDateTime(order.created_at)}
                </p>
              </td>
              <td>
                <p className="text-sm text-ink-800">{order.customer_name}</p>
                <p className="text-xs text-ink-400">{order.customer_phone}</p>
              </td>
              <td className="text-sm">
                <div className="min-w-[150px]">
                  {order.items.map((item) => (
                    <div key={item.id} className="text-[11px] text-ink-600">
                      {item.name}{item.variant_name ? ` (${item.variant_name})` : ""} × {item.quantity}
                    </div>
                  ))}
                </div>
              </td>
              <td className="text-sm capitalize">{order.fulfilment_type}</td>
              <td>
                <StatusBadge status={order.status} />
                <p className="mt-1 text-[11px] text-ink-400">
                  {order.status.replace(/_/g, " ")}
                </p>
              </td>
              <td>
                <Badge
                  tone={
                    order.payment_status === "paid"
                      ? "success"
                      : order.payment_status === "failed"
                        ? "danger"
                        : "warning"
                  }
                >
                  {order.payment_status}
                </Badge>
              </td>
              <td className="text-right font-semibold">
                {formatMoney(Number(order.total))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
