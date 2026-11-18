import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Phone, Mail, Truck, Package, Clock, ExternalLink } from "lucide-react";
import { requireActiveVendorContext } from "@/lib/auth";
import { getOrderForActor } from "@/lib/orders";
import { storeBase } from "@/lib/storefront-base";
import { workflowFor, workflowLabel } from "@/lib/storefront";
import { formatMoney, formatDateTime, titleCase } from "@/lib/utils";
import { Alert, Badge, Card, CardHeader, Field, PageHeader, StatusBadge } from "@/components/ui";
import { OrderTimeline } from "@/components/order-timeline";
import { OrderUpdateForm } from "@/components/vendor-forms";

export const metadata: Metadata = { title: "Order detail · Vendor dashboard" };

function availableActions(status: string, paid: boolean): Array<{ key: string; label: string }> {
  if (["cancelled", "rejected", "refunded"].includes(status)) return [];
  const actions: Array<{ key: string; label: string }> = [];
  if (["placed", "payment_confirmed", "pending"].includes(status)) {
    if (paid) actions.push({ key: "accept", label: "Accept order" });
    actions.push({ key: "reject", label: "Reject order" });
    return actions;
  }
  if (status === "accepted") {
    actions.push({ key: "preparing", label: "Start preparing" });
    actions.push({ key: "production_start", label: "Start production" });
    actions.push({ key: "dispatch", label: "Mark dispatched" });
    actions.push({ key: "cancel", label: "Cancel order" });
    return actions;
  }
  if (["preparing", "in_production", "awaiting_production"].includes(status)) {
    actions.push({ key: "production_complete", label: "Production complete" });
    actions.push({ key: "ready", label: "Ready for pickup / dispatch" });
    actions.push({ key: "dispatch", label: "Mark dispatched" });
    actions.push({ key: "progress", label: "Update progress only" });
    actions.push({ key: "cancel", label: "Cancel order" });
    return actions;
  }
  if (["production_completed", "ready_for_dispatch", "ready_for_pickup"].includes(status)) {
    actions.push({ key: "dispatch", label: "Mark dispatched" });
    actions.push({ key: "complete", label: "Verify Delivery PIN & complete" });
    return actions;
  }
  if (status === "dispatched") {
    actions.push({ key: "complete", label: "Verify Delivery PIN & complete" });
    return actions;
  }
  if (status === "delivered" || status === "in_service") {
    actions.push({ key: "complete", label: "Verify Delivery PIN & complete" });
    return actions;
  }
  return actions;
}

export default async function VendorOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireActiveVendorContext();
  const detail = await getOrderForActor(id, { id: ctx.user.id, role: ctx.user.role, email: ctx.user.email });
  if (!detail || !detail.isOwner) notFound();
  const { order, items, history, tracking, category } = detail;
  const base = await storeBase(ctx.store.slug);
  const actions = availableActions(order.status, order.payment_status === "paid");
  const workflow = workflowFor(category);

  return (
    <div className="space-y-4">
      <Link href="/vendor/payment-approvals" className="btn-secondary">Review bank-transfer receipts</Link>
      <PageHeader
        title={order.reference}
        description={`${formatDateTime(order.created_at)} · ${titleCase(order.fulfilment_type)}`}
        breadcrumb={<Link href="/vendor/orders" className="hover:text-brand-700">← Orders</Link>}
        actions={
          <>
            <StatusBadge status={order.status} />
            <Badge tone={order.payment_status === "paid" ? "success" : "warning"}>{order.payment_status}</Badge>
          </>
        }
      />

      {order.status === "placed" && order.payment_status === "paid" ? (
        <Alert tone="warning" title="Action needed">
          This order is paid and waiting for you to accept it. Accepting confirms the timeline shown to the customer.
        </Alert>
      ) : null}
      {order.payment_status !== "paid" ? (
        <Alert tone="info" title="Payment not confirmed">
          You can only accept this order once payment is confirmed. You may reject or cancel it now.
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Items" description={`${items.length} line item${items.length === 1 ? "" : "s"}`} />
            <div className="table-wrap rounded-none border-0">
              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-center">Qty</th>
                    <th className="text-right">Unit</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <p className="font-medium text-ink-900">{item.name}</p>
                        {item.variant_name ? <p className="text-xs text-ink-400">{item.variant_name}</p> : null}
                        {item.attributes && Object.keys(item.attributes).length > 0 ? (
                          <p className="text-xs text-ink-400">
                            {Object.entries(item.attributes).map(([key, value]) => `${key}: ${value}`).join(" · ")}
                          </p>
                        ) : null}
                      </td>
                      <td className="text-center">{item.quantity}</td>
                      <td className="text-right">{formatMoney(Number(item.unit_price))}</td>
                      <td className="text-right font-medium">{formatMoney(Number(item.line_total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-1.5 border-t border-ink-100 px-5 py-4 text-sm">
              <div className="flex justify-between"><span className="text-ink-500">Subtotal</span><span>{formatMoney(Number(order.subtotal))}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">Delivery</span><span>{formatMoney(Number(order.delivery_fee))}</span></div>
              {Number(order.discount) > 0 ? <div className="flex justify-between"><span className="text-ink-500">Discount</span><span>−{formatMoney(Number(order.discount))}</span></div> : null}
              <div className="flex justify-between border-t border-ink-100 pt-1.5 text-base font-bold"><span>Total</span><span>{formatMoney(Number(order.total))}</span></div>
              <div className="flex justify-between text-xs text-ink-400"><span>Platform commission (5%)</span><span>{formatMoney(Number(order.platform_commission))}</span></div>
              <div className="flex justify-between text-xs font-semibold text-brand-800"><span>Your payout</span><span>{formatMoney(Number(order.vendor_payable))}</span></div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Timeline" description="Customers see every step marked customer-visible." />
            <div className="card-pad">
              <OrderTimeline category={category} history={history} currentStatus={order.status} />
            </div>
          </Card>

          {tracking.length > 0 ? (
            <Card>
              <CardHeader title="Tracking updates" />
              <ul className="divide-y divide-ink-100">
                {tracking.map((entry) => (
                  <li key={entry.id} className="px-5 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-ink-900">{entry.status ? titleCase(entry.status) : entry.message}</p>
                      <p className="text-xs text-ink-400">{formatDateTime(entry.occurred_at)}</p>
                    </div>
                    {entry.message ? <p className="text-ink-500">{entry.message}</p> : null}
                    {entry.tracking_number ? <p className="text-xs text-ink-400">{entry.carrier} · {entry.tracking_number}</p> : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {order.customer_notes ? (
            <Card className="card-pad">
              <h2 className="text-sm font-semibold text-ink-900">Customer notes</h2>
              <p className="mt-1 whitespace-pre-line text-sm text-ink-600">{order.customer_notes}</p>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Customer" />
            <div className="card-pad space-y-3 text-sm">
              <p className="font-semibold text-ink-900">{order.customer_name}</p>
              <p className="flex items-center gap-2 text-ink-600"><Phone className="size-4 text-ink-400" /> {order.customer_phone}</p>
              <p className="flex items-center gap-2 break-all text-ink-600"><Mail className="size-4 shrink-0 text-ink-400" /> {order.customer_email}</p>
              {Object.values(order.delivery_address ?? {}).filter(Boolean).length > 0 ? (
                <p className="flex items-start gap-2 text-ink-600">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-ink-400" />
                  <span>{Object.values(order.delivery_address).filter(Boolean).join(", ")}</span>
                </p>
              ) : null}
              {order.pickup_location ? (
                <p className="rounded-lg bg-brand-50/70 p-2 text-xs text-brand-900">
                  <strong>Pickup location:</strong> {order.pickup_location}
                </p>
              ) : null}
              {order.delivery_notes ? <p className="rounded-lg bg-ink-50 p-2 text-xs text-ink-600">{order.delivery_notes}</p> : null}
              {order.dispute_status === "open" ? (
                <Alert tone="danger" title="Customer reported a delivery dispute">
                  {order.dispute_reason ?? "Please contact the customer and resolve handover."}
                </Alert>
              ) : null}
              {order.delivery_confirmed_at ? (
                <Alert tone="success" title="Delivery verified">
                  Confirmed {order.delivery_confirmed_by === "pin" ? "via 6-digit PIN" : "by customer"} · Payout released.
                </Alert>
              ) : null}
              {order.scheduled_for ? (
                <p className="flex items-center gap-2 text-ink-600"><Clock className="size-4 text-ink-400" /> Scheduled {formatDateTime(order.scheduled_for)}</p>
              ) : null}
              {["dispatched", "delivered", "completed"].includes(order.status) ? (
                <p className="flex items-center gap-2 text-ink-600">
                  <Truck className="size-4 text-ink-400" />
                  {order.dispatch_rider_name ? `${order.dispatch_rider_name}${order.dispatch_rider_phone ? ` (${order.dispatch_rider_phone})` : ""} · ` : ""}
                  {order.tracking_carrier ?? "Dispatch"} {order.tracking_number ? `· ${order.tracking_number}` : ""}
                </p>
              ) : null}
            </div>
          </Card>

          {actions.length > 0 ? (
            <Card>
              <CardHeader title="Fulfilment" description={`Current stage: ${workflowLabel(category, order.status)}`} />
              <div className="card-pad space-y-3">
                <OrderUpdateForm orderId={order.id} actions={actions}>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Dispatch ETA" htmlFor={`dispatchEta-${order.id}`}>
                      <input id={`dispatchEta-${order.id}`} name="dispatchEta" type="date" className="input" />
                    </Field>
                    <Field label="Delivery ETA" htmlFor={`deliveryEta-${order.id}`}>
                      <input id={`deliveryEta-${order.id}`} name="deliveryEta" type="date" className="input" />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Carrier" htmlFor={`carrier-${order.id}`}>
                      <input id={`carrier-${order.id}`} name="trackingCarrier" className="input" placeholder="e.g. GIG Logistics" />
                    </Field>
                    <Field label="Tracking number" htmlFor={`tracking-${order.id}`}>
                      <input id={`tracking-${order.id}`} name="trackingNumber" className="input" />
                    </Field>
                  </div>
                  <Field label="Production progress (%)" htmlFor={`progress-${order.id}`}>
                    <input id={`progress-${order.id}`} name="productionProgress" type="number" min="0" max="100" step="5" className="input" placeholder={String(order.production_progress ?? 0)} />
                  </Field>
                </OrderUpdateForm>
              </div>
            </Card>
          ) : (
            <Card className="card-pad">
              <p className="text-sm text-ink-500">This order has no further fulfilment steps.</p>
            </Card>
          )}

          <Card className="card-pad space-y-2 text-sm">
            <h2 className="text-sm font-semibold text-ink-900">Quick links</h2>
            <Link href={`${base}/track?reference=${order.reference}`} target="_blank" className="flex items-center gap-2 text-brand-700 hover:underline">
              <ExternalLink className="size-3.5" /> Customer tracking page
            </Link>
            <Link href={`/vendor/customers?q=${encodeURIComponent(order.customer_email)}`} className="flex items-center gap-2 text-brand-700 hover:underline">
              <Package className="size-3.5" /> Customer history
            </Link>
            <p className="pt-1 text-xs text-ink-400">Workflow: {workflow.map((stage) => stage.label).join(" → ")}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
