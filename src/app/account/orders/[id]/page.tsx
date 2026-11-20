import { OrderTimingRefresh } from "@/components/order-timing-form";
import { formatNigeriaTime } from "@/lib/order-timing";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Download, Mail, MapPin, Phone, Star, Store, Truck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { getOrderForActor } from "@/lib/orders";
import { storeBase } from "@/lib/storefront-base";
import { workflowLabel } from "@/lib/storefront";
import { formatMoney, formatDateTime, titleCase } from "@/lib/utils";
import { Alert, Badge, ButtonLink, Card, CardHeader, PageHeader, StatusBadge } from "@/components/ui";
import { OrderTimeline } from "@/components/order-timeline";
import { OrderDeliveryVerification } from "@/components/order-delivery-verification";
import { ReviewForm } from "@/components/review-form";

export const metadata: Metadata = { title: "Order detail · Ibom Vendors Hub" };

export default async function AccountOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(["customer", "vendor", "admin", "super_admin"]);
  const detail = await getOrderForActor(id, { id: user.id, role: user.role, email: user.email });
  if (!detail || (!detail.isCustomer && !detail.isAdmin)) notFound();
  const { order, items, history, tracking, category } = detail;
  const [base, existingReviews] = await Promise.all([
    storeBase(order.store_slug),
    systemDb.query<{
      id: string;
      product_id: string | null;
      rating: number;
      title: string | null;
      comment: string | null;
      created_at: string;
    }>(
      `select id, product_id, rating, title, comment, created_at
         from reviews
        where order_id = $1`,
      [order.id],
    ),
  ]);

  const manualPayment = await systemDb.maybeOne<{ reference: string; status: string }>(`select p.reference, m.status from manual_order_payments m join payments p on p.id=m.payment_id where m.order_id=$1`, [order.id]);
  const canReview = ["delivered", "completed"].includes(order.status);
  const reviewedProductIds = new Set(
    existingReviews.map((r) => r.product_id ?? "__store__"),
  );
  const vendorPickupFull = [order.store_name, order.store_address, order.store_city, order.store_state ?? "Akwa Ibom"]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-4">
      <OrderTimingRefresh />
      {order.fulfilment_expected_at ? <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
        <h2 className="text-lg font-bold text-brand-900">{order.fulfilment_type === "pickup" ? "Come for pickup" : "Expected arrival at your location"}</h2>
        <p className="mt-2 text-xl font-semibold text-brand-800">{formatNigeriaTime(order.fulfilment_expected_at)}</p>
        {order.fulfilment_timing_note ? <p className="mt-2 whitespace-pre-wrap text-sm text-ink-700">{order.fulfilment_timing_note}</p> : null}
        {order.fulfilment_type === "pickup" && order.pickup_location ? <p className="mt-2 text-sm text-ink-600">Pickup location: {order.pickup_location}</p> : null}
        <p className="mt-2 text-xs text-ink-500">Estimated time shared by {order.store_name}. All times are Nigeria time (WAT). This is not a delivery confirmation.</p>
      </div> : null}
      {manualPayment ? <div className="card card-pad"><p className="font-semibold">{manualPayment.status === "approved" ? "Approved" : manualPayment.status === "awaiting_approval" ? "Awaiting payment approval" : "Bank transfer payment"}</p><p className="mt-1 text-sm text-ink-500">Paid directly to the vendor, not platform escrow. Any refund must be arranged with the vendor.</p><Link href={`/pay/${manualPayment.reference}`} className="btn-primary mt-3">{manualPayment.status === "approved" ? "View payment approval" : "View bank details / upload receipt"}</Link></div> : null}
      <PageHeader
        title={order.reference}
        description={`${order.store_name} · placed ${formatDateTime(order.created_at)}`}
        breadcrumb={<Link href="/account/orders" className="hover:text-brand-700">← My orders</Link>}
        actions={
          <>
            <StatusBadge status={order.status} />
            <Badge tone={order.payment_status === "paid" ? "success" : "warning"}>{order.payment_status}</Badge>
            <ButtonLink href={`/account/orders/${order.id}/invoice`} variant="ghost" size="sm">
              Invoice
            </ButtonLink>
          </>
        }
      />

      {order.status === "ready_for_pickup" ? (
        <Alert tone="success" title="Ready for pickup at vendor's location">
          Your order is ready at {order.pickup_location || vendorPickupFull}. Bring your 6-digit Pickup PIN below when collecting.
        </Alert>
      ) : null}
      {order.status === "dispatched" ? (
        <Alert tone="info" title="On the way via dispatch">
          Your order has been dispatched{order.tracking_carrier ? ` with ${order.tracking_carrier}` : ""}
          {order.tracking_number ? ` (${order.tracking_number})` : ""}. Only share your 6-digit Delivery PIN once the item is in your hands.
        </Alert>
      ) : null}
      {order.status === "rejected" ? (
        <Alert tone="danger" title="Order rejected">{order.rejection_reason ?? "The vendor could not accept this order."} A refund will be processed if you were charged.</Alert>
      ) : null}

      <OrderDeliveryVerification
        orderId={order.id}
        status={order.status}
        paymentStatus={order.payment_status}
        fulfilmentType={order.fulfilment_type}
        deliveryPin={order.delivery_pin}
        deliveryConfirmedAt={order.delivery_confirmed_at}
        deliveryConfirmedBy={order.delivery_confirmed_by}
        disputeStatus={order.dispute_status}
        disputeReason={order.dispute_reason}
        dispatchRiderName={order.dispatch_rider_name}
        dispatchRiderPhone={order.dispatch_rider_phone}
        pickupLocation={order.pickup_location || (order.fulfilment_type === "pickup" ? vendorPickupFull : null)}
      />

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
              <div className="flex justify-between">
                <span className="text-ink-500">{order.fulfilment_type === "pickup" ? "Vendor pickup" : "Dispatch delivery"}</span>
                <span>{order.fulfilment_type === "pickup" ? "Free" : formatMoney(Number(order.delivery_fee))}</span>
              </div>
              {Number(order.service_fee) > 0 ? <div className="flex justify-between"><span className="text-ink-500">Service fee</span><span>{formatMoney(Number(order.service_fee))}</span></div> : null}
              {Number(order.discount) > 0 ? <div className="flex justify-between"><span className="text-ink-500">Discount</span><span>−{formatMoney(Number(order.discount))}</span></div> : null}
              <div className="flex justify-between border-t border-ink-100 pt-1.5 text-base font-bold"><span>Total</span><span>{formatMoney(Number(order.total))}</span></div>
            </div>
          </Card>

          {/* Post-Purchase Verified Customer Reviews */}
          <Card id="reviews">
            <CardHeader
              title="Leave a review"
              description={
                canReview
                  ? "Share your honest experience with other Akwa Ibom shoppers."
                  : "Reviews unlock automatically once your order is delivered and confirmed."
              }
            />
            <div className="card-pad space-y-4">
              {!canReview ? (
                <p className="text-sm text-ink-500">
                  Once you receive your order and confirm delivery above, you can rate and review every item right here.
                </p>
              ) : (
                <>
                  {items.map((item) => {
                    const key = item.product_id ?? "__store__";
                    const existing = existingReviews.find((r) => (r.product_id ?? "__store__") === key);
                    if (existing || reviewedProductIds.has(key)) {
                      return (
                        <div key={item.id} className="rounded-xl border border-ink-100 bg-ink-50/50 p-4 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <p className="flex items-center gap-1.5 font-semibold text-ink-900">
                              <CheckCircle2 className="size-4 text-brand-700" /> Reviewed: {item.name}
                            </p>
                            {existing ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                                <Star className="size-3.5 fill-amber-400 text-amber-400" /> {existing.rating}/5
                              </span>
                            ) : null}
                          </div>
                          {existing?.title ? <p className="mt-1 font-medium text-ink-800">{existing.title}</p> : null}
                          {existing?.comment ? <p className="mt-0.5 text-ink-600">{existing.comment}</p> : null}
                        </div>
                      );
                    }
                    return (
                      <ReviewForm
                        key={item.id}
                        orderId={order.id}
                        productId={item.product_id}
                        itemLabel={item.name}
                      />
                    );
                  })}
                </>
              )}
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
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Store (Akwa Ibom)</p>
            <p className="flex items-center gap-2 font-semibold text-ink-900"><Store className="size-4 text-brand-600" /> {order.store_name}</p>
            {order.store_address || order.store_city ? (
              <p className="text-xs text-ink-500">
                {[order.store_address, order.store_city, order.store_state ?? "Akwa Ibom"].filter(Boolean).join(", ")}
              </p>
            ) : null}
            <ButtonLink href={base} variant="secondary" size="sm" className="w-full">Visit storefront</ButtonLink>
            <ButtonLink href={`${base}/track?reference=${order.reference}`} variant="ghost" size="sm" className="w-full">Track order</ButtonLink>
          </Card>

          <Card className="card-pad space-y-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
              {order.fulfilment_type === "pickup" ? "Customer bio & pickup location" : "Customer bio & delivery details"}
            </p>
            <p className="flex items-center gap-2 text-ink-600"><Phone className="size-4 text-ink-400" /> {order.customer_phone}</p>
            <p className="flex items-center gap-2 break-all text-ink-600"><Mail className="size-4 shrink-0 text-ink-400" /> {order.customer_email}</p>
            {order.fulfilment_type === "pickup" ? (
              <p className="flex items-start gap-2 text-ink-600">
                <MapPin className="mt-0.5 size-4 shrink-0 text-brand-600" />
                <span><strong>Pickup at:</strong> {order.pickup_location || vendorPickupFull}</span>
              </p>
            ) : Object.values(order.delivery_address ?? {}).filter(Boolean).length > 0 ? (
              <p className="flex items-start gap-2 text-ink-600"><MapPin className="mt-0.5 size-4 shrink-0 text-ink-400" /><span>{[order.delivery_address.address, order.delivery_address.city, order.delivery_address.state].filter(Boolean).join(", ") || Object.values(order.delivery_address).filter(Boolean).join(", ")}</span></p>
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
            {order.status === "dispatched" ? <p className="flex items-center gap-1.5 text-xs text-ink-400"><Truck className="size-3.5" /> {order.tracking_carrier ?? "Dispatch rider"}</p> : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
