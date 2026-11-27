import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Mail, Phone, MapPin, Truck, Clock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { getOrderForActor } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { storeBase } from "@/lib/storefront-base";
import { workflowLabel } from "@/lib/storefront";
import { formatMoney, formatDateTime, titleCase } from "@/lib/utils";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Order invoice · Ibom Vendors Hub" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(["customer", "vendor", "admin", "super_admin"]);
  const detail = await getOrderForActor(id, { id: user.id, role: user.role, email: user.email });
  if (!detail || (!detail.isCustomer && !detail.isAdmin)) notFound();

  const { order, items } = detail;
  const settings = await getSettings();
  const base = await storeBase(order.store_slug);
  const currency = "NGN";

  const vendorPickupFull = [
    order.store_name,
    order.store_address,
    order.store_city,
    order.store_state ?? "Akwa Ibom",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="min-h-screen bg-white text-ink-900">
      {/* No-scroll print hint removed — browser print dialog handles layout */}
      <div className="container-page py-6 sm:py-10">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                INVOICE
              </span>
            </div>
            <h1 className="mt-2 font-display text-3xl text-ink-900">Ibom Vendors Hub</h1>
            <p className="text-sm text-ink-500">
              {settings.support_email} &bull; {settings.support_phone}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-ink-900">{order.reference}</p>
            <p className="text-xs text-ink-500">
              Invoice date:{" "}
              <time dateTime={order.created_at}>{formatDateTime(order.created_at)}</time>
            </p>
          </div>
        </div>

        {/* From / To */}
        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          <Card className="card-pad">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-3">
              From
            </h2>
            <p className="font-semibold text-ink-900 whitespace-nowrap">{settings.platform_name}</p>
            <p className="text-sm text-ink-600">{settings.support_email}</p>
            <p className="text-sm text-ink-600">{settings.support_phone}</p>
            <p className="text-sm text-ink-600">Akwa Ibom, Nigeria</p>
          </Card>

          <Card className="card-pad">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-3">
              Bill to
            </h2>
            <p className="font-semibold text-ink-900">{order.customer_name}</p>
            <p className="text-sm text-ink-600">{order.customer_email}</p>
            {order.customer_phone ? <p className="text-sm text-ink-600">{order.customer_phone}</p> : null}
          </Card>
        </div>

        {/* Order info */}
        <div className="grid gap-6 lg:grid-cols-3 mb-8">
          <Card className="card-pad">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-3">
              Store
            </h2>
            <p className="font-semibold text-ink-900">{order.store_name}</p>
            {order.store_address || order.store_city ? (
              <p className="text-sm text-ink-600">
                {[order.store_address, order.store_city, order.store_state ?? "Akwa Ibom"]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            ) : null}
          </Card>

          <Card className="card-pad">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-3">
              Fulfilment
            </h2>
            <p className="text-sm text-ink-600">{titleCase(order.fulfilment_type)}</p>
            {order.fulfilment_type === "delivery" && order.tracking_number ? (
              <p className="text-sm text-ink-600">
                Tracking: {order.tracking_number}
              </p>
            ) : null}
          </Card>

          <Card className="card-pad">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-3">
              Status
            </h2>
            <p className="text-sm font-semibold text-ink-600">
              {titleCase(order.status)}
            </p>
            <p className="text-xs text-ink-400 mt-1">
              Payment: {titleCase(order.payment_status)}
            </p>
          </Card>
        </div>

        {/* Items table */}
        <Card className="card-pad mb-8">
          <h2 className="text-base font-semibold text-ink-900 mb-4">Order items</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-ink-200">
                  <th className="pb-3 text-left text-xs font-semibold text-ink-400">Item</th>
                  <th className="pb-3 text-left text-xs font-semibold text-ink-400">Qty</th>
                  <th className="pb-3 text-right text-xs font-semibold text-ink-400">Unit price</th>
                  <th className="pb-3 text-right text-xs font-semibold text-ink-400">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {items.map((item) => (
                  <tr key={item.id} className="text-ink-700">
                    <td className="py-4">
                      <p className="font-medium">{item.name}</p>
                      {item.variant_name ? (
                        <p className="text-xs text-ink-500">{item.variant_name}</p>
                      ) : null}
                    </td>
                    <td className="py-4 text-center">{item.quantity}</td>
                    <td className="py-4 text-right tabular-nums">
                      {formatMoney(Number(item.unit_price), currency, "₦")}
                    </td>
                    <td className="py-4 text-right tabular-nums font-semibold">
                      {formatMoney(Number(item.line_total), currency, "₦")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-full max-w-xs space-y-1.5 text-right">
            <div className="flex justify-between text-sm text-ink-600">
              <span>Subtotal</span>
              <span>{formatMoney(Number(order.subtotal), currency, "₦")}</span>
            </div>
            {Number(order.delivery_fee) > 0 && (
              <div className="flex justify-between text-sm text-ink-600">
                <span>{titleCase(order.fulfilment_type)} delivery</span>
                <span>{formatMoney(Number(order.delivery_fee), currency, "₦")}</span>
              </div>
            )}
            {Number(order.service_fee) > 0 && (
              <div className="flex justify-between text-sm text-ink-600">
                <span>Service fee</span>
                <span>{formatMoney(Number(order.service_fee), currency, "₦")}</span>
              </div>
            )}
            {Number(order.discount) > 0 && (
              <div className="flex justify-between text-sm text-ink-600">
                <span>Discount</span>
                <span>−{formatMoney(Number(order.discount), currency, "₦")}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-ink-200 pt-2 text-base font-bold text-ink-900">
              <span>Total</span>
              <span>{formatMoney(Number(order.total), currency, "₦")}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 border-t border-ink-200 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-ink-500">
              <p>
                {order.store_name} &bull; {order.store_city}, {order.store_state ?? "Akwa Ibom"}
              </p>
              <p>Order placed {formatDateTime(order.created_at)}</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-ink-500">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1 underline hover:text-brand-700 font-medium"
              >
                <span>🖨️</span> Print or save as PDF
              </button>
            </div>
          </div>
          <p className="mt-4 text-[11px] text-ink-400">
            This invoice is generated by Ibom Vendors Hub. For support, email
            {settings.support_email} or call {settings.support_phone}. All amounts are in Nigerian
            Naira (NGN).
          </p>
        </div>
      </div>

      <style>
        {`
          @media print {
            body { background: white !important; }
            .no-print, header, footer, nav, aside, .no-print * { display: none !important; }
            a { text-decoration: none; color: inherit; }
            button { display: none; }
            .container-page { max-width: 100% !important; padding: 0 !important; }
            .card { border: none; box-shadow: none; }
          }
        `}
      </style>
    </div>
  );
}
