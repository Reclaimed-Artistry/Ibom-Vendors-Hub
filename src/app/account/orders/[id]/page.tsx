import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, MapPin, Phone, Mail, Store, Truck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getOrderForActor } from "@/lib/orders";
import { storeBase } from "@/lib/storefront-base";
import { workflowLabel } from "@/lib/storefront";
import { formatMoney, formatDateTime, titleCase } from "@/lib/utils";
import { Alert, Badge, ButtonLink, Card, CardHeader, PageHeader, StatusBadge } from "@/components/ui";
import { OrderTimeline } from "@/components/order-timeline";

export const metadata: Metadata = { title: "Order detail · Ibom Vendors Hub" };

export default async function AccountOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(["customer"]);
  const detail = await getOrderForActor(id, { id: user.id, role: user.role, email: user.email });
  if (!detail || (!detail.isCustomer && !detail.isAdmin)) notFound();
  const { order, items, history, tracking, category } = detail;
  const base = await storeBase(order.store_slug);

  return (
    <div className="space-y-4">
      <PageHeader
        title={order.reference}
        description={`${order.store_name} · placed ${formatDateTime(order.created_at)}`}
        breadcrumb={<Link href="/account/orders" className="hover:text-brand-700">← My orders</Link>}
        actions={
          <>
            <StatusBadge status={order.status} />
            <Badge tone={order.payment_status === "paid" ? "success" : "warning"}>{order.payment_status}</Badge>
          </>
        }
      />

      {order.status === "ready_for_pickup" ? (
        <Alert tone="success" title="Ready for pickup">Your order is ready. Contact the vendor to arrange collection.</Alert>
      ) : null}
      {order.status === "dispatched" ? (
        <Alert tone="info" title="On the way">Your order has been dispatched{order.tracking_carrier ? ` with ${order.tracking_carrier}` : ""}{order.tracking_number ? ` (${order.tracking_number})` : ""}.</Alert>
      ) : null}
      {order.status === "rejected" ? (
        <Alert tone="danger" title="Order rejected">{order.rejection_reason ?? "The vendor could not accept this order."} A refund will be processed if you were charged.</Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Items" />
            <ul className="divide-y divide-ink-100">
              {items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="font-medium text-ink-900">{item.name}</p>
                    {item.variant_name ? <p className="text-xs text-ink-500">{item.variant_name}</p> : null}
                    <p className="text-xs text-ink-400">{item.quantity} × {formatMoney(Number(item.unit_price))}</p>
                  </div>
                  <span className="text-sm font-semibold">{formatMoney(Number(item.line_total))}</span>
                </li>
              ))}
            </ul>
            <div className="space-y-1.5 border-t border-ink-100 px-5 py-4 text-sm">
              <div className="flex justify-between"><span className="text-ink-500">Subtotal</span><span>{formatMoney(Number(order.subtotal))}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">Delivery</span><span>{formatMoney(Number(order.delivery_fee))}</span></div>
              {Number(order.service_fee) > 0 ? <div className="flex justify-between"><span className="text-ink-500">Service fee</span><span>{formatMoney(Number(order.service_fee))}</span></div> : null}
              {Number(order.discount) > 0 ? <div className="flex justify-between"><span className="text-ink-500">Discount</span><span>−{formatMoney(Number(order.discount))}</span></div> : null}
              <div className="flex justify-between border-t border-ink-100 pt-1.5 text-base font-bold"><span>Total</span><span>{formatMoney(Number(order.total))}</span></div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Timeline" description={`Current stage: ${workflowLabel(category, order.status)}`} />
            <div className="card-pad"><OrderTimeline category={category} history={history} currentStatus={order.status} /></div>
          </Card>

          {tracking.length > 0 ? (
            <Card>
              <CardHeader title="Tracking" />
              <ul className="divide-y divide-ink-100">
                {tracking.map((entry) => (
                  <li key={entry.id} className="px-5 py-3 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <p className="font-medium text-ink-900">{entry.status ? titleCase(entry.status) : entry.message}</p>
                      <p className="text-xs text-ink-400">{formatDateTime(entry.occurred_at)}</p>
                    </div>
                    {entry.message ? <p className="text-ink-500">{entry.message}</p> : null}
                    {entry.location ? <p className="text-xs text-ink-400">{entry.location}</p> : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card className="card-pad space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Store</p>
            <p className="flex items-center gap-2 font-semibold text-ink-900"><Store className="size-4 text-brand-600" /> {order.store_name}</p>
            <ButtonLink href={base} variant="secondary" size="sm" className="w-full">Visit storefront</ButtonLink>
            <ButtonLink href={`${base}/track?reference=${order.reference}`} variant="ghost" size="sm" className="w-full">Track order</ButtonLink>
          </Card>

          <Card className="card-pad space-y-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Delivery details</p>
            <p className="flex items-center gap-2 text-ink-600"><Phone className="size-4 text-ink-400" /> {order.customer_phone}</p>
            <p className="flex items-center gap-2 break-all text-ink-600"><Mail className="size-4 shrink-0 text-ink-400" /> {order.customer_email}</p>
            {Object.values(order.delivery_address ?? {}).filter(Boolean).length > 0 ? (
              <p className="flex items-start gap-2 text-ink-600"><MapPin className="mt-0.5 size-4 shrink-0 text-ink-400" /><span>{Object.values(order.delivery_address).filter(Boolean).join(", ")}</span></p>
            ) : (
              <p className="text-ink-500">Pickup at the store.</p>
            )}
            {order.scheduled_for ? <p className="text-ink-600">Scheduled for {formatDateTime(order.scheduled_for)}</p> : null}
          </Card>

          <Card className="card-pad space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Need help?</p>
            <p className="text-sm text-ink-500">Message the vendor directly or contact platform support.</p>
            <ButtonLink href="/contact" variant="secondary" size="sm" className="w-full">Contact support</ButtonLink>
            <ButtonLink href="/track" variant="ghost" size="sm" className="w-full"><Download className="size-3.5" /> Order tracking</ButtonLink>
            {order.status === "dispatched" ? <p className="flex items-center gap-1.5 text-xs text-ink-400"><Truck className="size-3.5" /> {order.tracking_carrier ?? "Courier"}</p> : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
