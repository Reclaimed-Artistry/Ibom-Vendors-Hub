import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, Package, Truck } from "lucide-react";
import { withPublic } from "@/lib/db";
import { formatDateTime, formatMoney, titleCase } from "@/lib/utils";
import { Badge, Card, Field, StatusBadge } from "@/components/ui";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Track an order" };

interface TrackPayload {
  order: {
    reference: string;
    checkout_reference: string;
    status: string;
    payment_status: string;
    fulfilment_type: string;
    currency: string;
    subtotal: number;
    delivery_fee: number;
    total: number;
    customer_name: string;
    customer_email: string;
    delivery_address: Record<string, string>;
    delivery_notes: string | null;
    scheduled_for: string | null;
    estimated_completion_date: string | null;
    estimated_dispatch_date: string | null;
    estimated_delivery_date: string | null;
    production_progress: number;
    tracking_number: string | null;
    tracking_carrier: string | null;
    created_at: string;
    cancelled_at: string | null;
    cancellation_reason: string | null;
  };
  store: { name: string; slug: string; logo_url: string | null; phone: string | null; email: string | null; city: string | null; state: string | null };
  items: Array<{ name: string; variant_name: string | null; quantity: number; unit_price: number; line_total: number; addons: Array<{ name: string; price: number }> }>;
  history: Array<{ status: string; previous: string | null; note: string | null; created_at: string; actor_role: string }>;
  tracking: Array<{ status: string | null; message: string | null; location: string | null; carrier: string | null; occurred_at: string }>;
  payment: { status: string; amount: number; currency: string; reference: string; paid_at: string | null; channel: string | null } | null;
}

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; contact?: string }>;
}) {
  const sp = await searchParams;
  const settings = await getSettings();
  let result: TrackPayload | null = null;
  let searched = false;

  if (sp.reference && sp.contact) {
    searched = true;
    result = await withPublic(async (db) => {
      const row = await db.maybeOne<{ data: TrackPayload | null }>(`select lookup_order($1,$2) as data`, [sp.reference, sp.contact]);
      return row?.data ?? null;
    });
  }

  return (
    <div className="container-page max-w-4xl py-12">
      <h1 className="font-display text-3xl text-ink-900">Track your order</h1>
      <p className="mt-1 text-sm text-ink-500">Enter your order reference and the email or phone number used at checkout.</p>

      <Card className="mt-6 card-pad">
        <form className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Order reference" htmlFor="reference">
            <input id="reference" name="reference" defaultValue={sp.reference} placeholder="IVH-2601-100001" className="input" required />
          </Field>
          <Field label="Email or phone" htmlFor="contact">
            <input id="contact" name="contact" defaultValue={sp.contact} placeholder="you@example.com" className="input" required />
          </Field>
          <button className="btn-primary">Track order</button>
        </form>
      </Card>

      {searched && !result ? (
        <div className="mt-6">
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-semibold">No order found</p>
              <p className="mt-1">We could not find an order with that reference and contact detail. Check the reference from your confirmation email and try again.</p>
            </div>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="mt-6 space-y-5">
          <Card className="card-pad">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <img src={result.store.logo_url ?? ""} alt="" className="size-12 rounded-xl border border-ink-100 object-cover" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{result.store.name}</p>
                  <p className="text-lg font-bold text-ink-900">{result.order.reference}</p>
                  <p className="text-xs text-ink-400">Placed {formatDateTime(result.order.created_at)} · {result.store.city}, {result.store.state}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={result.order.status} />
                <Badge tone={result.order.payment_status === "paid" ? "success" : "warning"}>
                  Payment: {titleCase(result.order.payment_status)}
                </Badge>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { label: "Estimated completion", value: result.order.estimated_completion_date, icon: Clock },
                { label: "Estimated dispatch", value: result.order.estimated_dispatch_date, icon: Package },
                { label: "Estimated arrival", value: result.order.estimated_delivery_date, icon: Truck },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-ink-100 bg-ink-50/60 p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                    <item.icon className="size-3.5" /> {item.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink-900">{item.value ? new Date(item.value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "To be confirmed"}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-ink-400">Dates shown are estimates from the vendor, not guaranteed delivery commitments.</p>

            {result.order.production_progress > 0 && result.order.production_progress < 100 ? (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs font-medium text-ink-500">
                  <span>Production progress</span>
                  <span>{result.order.production_progress}%</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${result.order.production_progress}%` }} />
                </div>
              </div>
            ) : null}
          </Card>

          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="card-pad">
              <h2 className="text-base font-semibold">Order timeline</h2>
              <ol className="mt-4 space-y-4">
                {result.history.map((entry, index) => (
                  <li key={`${entry.status}-${index}`} className="flex gap-3">
                    <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                      <CheckCircle2 className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-ink-900">{titleCase(entry.status)}</p>
                      <p className="text-xs text-ink-400">{formatDateTime(entry.created_at)}</p>
                      {entry.note ? <p className="mt-0.5 text-xs text-ink-500">{entry.note}</p> : null}
                    </div>
                  </li>
                ))}
                {result.history.length === 0 ? <li className="text-sm text-ink-500">No updates yet.</li> : null}
              </ol>

              {result.tracking.length ? (
                <div className="mt-6 border-t border-ink-100 pt-4">
                  <h3 className="text-sm font-semibold">Delivery tracking</h3>
                  <ul className="mt-2 space-y-2 text-sm text-ink-600">
                    {result.tracking.map((entry, index) => (
                      <li key={index} className="rounded-lg bg-ink-50 px-3 py-2">
                        <p className="font-medium text-ink-800">{entry.message ?? entry.status}</p>
                        <p className="text-xs text-ink-400">
                          {entry.carrier ? `${entry.carrier} · ` : ""}{entry.occurred_at ? formatDateTime(entry.occurred_at) : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Card>

            <div className="space-y-5">
              <Card className="card-pad">
                <h2 className="text-base font-semibold">Items</h2>
                <ul className="mt-3 space-y-3">
                  {result.items.map((item, index) => (
                    <li key={index} className="flex justify-between gap-3 text-sm">
                      <div>
                        <p className="font-medium text-ink-800">{item.name}</p>
                        <p className="text-xs text-ink-400">
                          {item.variant_name ? `${item.variant_name} · ` : ""}Qty {item.quantity}
                        </p>
                        {item.addons?.length ? <p className="text-xs text-ink-400">+ {item.addons.map((addon) => addon.name).join(", ")}</p> : null}
                      </div>
                      <span className="whitespace-nowrap font-semibold">{formatMoney(item.line_total, result!.order.currency, settings.currency_symbol)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 space-y-1.5 border-t border-ink-100 pt-3 text-sm">
                  <div className="flex justify-between text-ink-500"><span>Subtotal</span><span>{formatMoney(result.order.subtotal, result.order.currency, settings.currency_symbol)}</span></div>
                  {result.order.delivery_fee > 0 ? <div className="flex justify-between text-ink-500"><span>Delivery</span><span>{formatMoney(result.order.delivery_fee, result.order.currency, settings.currency_symbol)}</span></div> : null}
                  <div className="flex justify-between text-base font-bold text-ink-900"><span>Total</span><span>{formatMoney(result.order.total, result.order.currency, settings.currency_symbol)}</span></div>
                </div>
              </Card>

              <Card className="card-pad">
                <h2 className="text-base font-semibold">Need help?</h2>
                <p className="mt-1.5 text-sm text-ink-500">
                  Contact {result.store.name} directly{result.store.phone ? ` on ${result.store.phone}` : ""}.
                </p>
                <Link href={`/s/${result.store.slug}`} className="btn-secondary mt-3 w-full">Visit storefront</Link>
              </Card>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
