import type { Metadata } from "next";
import Link from "next/link";
import { Check, Clock, CreditCard, Sparkles } from "lucide-react";
import { getVendorContext } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { getPlans, getStoreSubscription, subscriptionState } from "@/lib/subscriptions";
import { formatMoney, formatDate, formatDateTime } from "@/lib/utils";
import { Alert, Badge, Card, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { SubscriptionPurchaseForm } from "@/components/vendor-forms";

export const metadata: Metadata = { title: "Subscription · Vendor dashboard" };

export default async function VendorSubscriptionPage() {
  const { store } = await getVendorContext();
  const [subscription, plans, payments] = await Promise.all([
    getStoreSubscription(store.id),
    getPlans(),
    systemDb.query<{ reference: string; amount: number; status: string; plan_name: string | null; paid_at: string | null; created_at: string; provider: string }>(
      `select p.reference, p.amount, p.status, sp.name as plan_name, p.paid_at, p.created_at, p.provider
         from payments p left join subscription_plans sp on sp.id = p.plan_id
        where p.store_id = $1 and p.scope = 'subscription'
        order by p.created_at desc limit 12`,
      [store.id],
    ),
  ]);
  const state = subscriptionState(subscription);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Subscription"
        description="Your plan keeps your storefront live. Renew before expiry — your catalogue and history are never deleted."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Current plan"
          value={subscription?.plan.name ?? "None"}
          hint={subscription ? `${subscription.status} · ${formatMoney(Number(subscription.plan.price))}` : "Choose a plan to go live"}
          icon={<Sparkles className="size-4" />}
        />
        <StatCard label="Time remaining" value={state.days} hint={state.expiresAt ? `Expires ${formatDate(state.expiresAt)}` : "—"} icon={<Clock className="size-4" />} />
        <StatCard label="Product limit" value={subscription?.plan.product_limit ?? "—"} hint="Upgrade for more listings" icon={<CreditCard className="size-4" />} />
      </div>

      {store.status === "expired" || state.days === 0 ? (
        <Alert tone="warning" title="Your storefront is offline">
          Renew your subscription to bring it back online instantly. Your products, images and order history are safe.
        </Alert>
      ) : state.days <= 5 ? (
        <Alert tone="warning" title={`Expires in ${state.days} day${state.days === 1 ? "" : "s"}`}>
          Renew now to avoid interruption. Payment is confirmed server-side before your plan extends.
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <Card>
            <CardHeader title="Plans" description="Prices are per month. Upgrading extends from your current expiry date." />
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {plans.map((plan) => {
                const current = subscription?.plan_id === plan.id;
                return (
                  <div key={plan.id} className={`rounded-2xl border p-4 ${current ? "border-brand-400 bg-brand-50/50" : "border-ink-100 bg-white"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-ink-900">{plan.name}</p>
                        <p className="text-xs text-ink-500">{plan.product_limit ? `${plan.product_limit} products` : "Unlimited products"}</p>
                      </div>
                      {current ? <Badge tone="success">Current</Badge> : plan.is_featured ? <Badge tone="info">Popular</Badge> : null}
                    </div>
                    <p className="mt-3 text-2xl font-bold text-ink-900">
                      {Number(plan.price) === 0 ? "Free" : formatMoney(Number(plan.price))}
                      {Number(plan.price) > 0 ? <span className="text-sm font-normal text-ink-400">/mo</span> : null}
                    </p>
                    <ul className="mt-3 space-y-1.5 text-sm text-ink-600">
                      {(plan.features ?? []).map((feature) => (
                        <li key={feature} className="flex items-start gap-1.5">
                          <Check className="mt-0.5 size-3.5 shrink-0 text-brand-600" /> {feature}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4">
                      <SubscriptionPurchaseForm planId={plan.id} label={current ? "Extend this plan" : Number(plan.price) === 0 ? "Switch to this plan" : "Choose plan"} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHeader title="Payment history" description="Subscription payments for this store." />
            {payments.length === 0 ? (
              <EmptyState icon={<CreditCard className="size-5" />} title="No subscription payments yet" description="Your free trial or first payment will appear here." />
            ) : (
              <div className="table-wrap rounded-none border-0">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Plan</th>
                      <th>Provider</th>
                      <th>Status</th>
                      <th className="text-right">Amount</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.reference}>
                        <td className="font-mono text-xs">{payment.reference}</td>
                        <td className="text-sm">{payment.plan_name ?? "—"}</td>
                        <td className="text-sm capitalize">{payment.provider}</td>
                        <td><Badge tone={payment.status === "success" ? "success" : payment.status === "failed" ? "danger" : "warning"}>{payment.status}</Badge></td>
                        <td className="text-right font-semibold">{formatMoney(Number(payment.amount))}</td>
                        <td className="text-xs text-ink-500">{formatDateTime(payment.paid_at ?? payment.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="card-pad space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Billing summary</p>
            <div className="flex justify-between text-sm"><span className="text-ink-500">Plan</span><span className="font-medium">{subscription?.plan.name ?? "—"}</span></div>
            <div className="flex justify-between text-sm"><span className="text-ink-500">Status</span><span className="font-medium capitalize">{subscription?.status ?? "none"}</span></div>
            <div className="flex justify-between text-sm"><span className="text-ink-500">Started</span><span className="font-medium">{formatDate(subscription?.started_at)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-ink-500">Expires</span><span className="font-medium">{formatDate(subscription?.expires_at)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-ink-500">Auto renew</span><span className="font-medium">{subscription?.auto_renew ? "On" : "Off"}</span></div>
            <p className="pt-2 text-xs text-ink-400">
              Commission on sales is 5%. Payments are verified with the gateway before any plan is extended.
            </p>
          </Card>

          <Card className="card-pad space-y-2">
            <p className="text-sm font-semibold text-ink-900">What happens if I don&apos;t renew?</p>
            <p className="text-sm text-ink-500">
              Your storefront goes offline after a 3-day grace period, but nothing is deleted. Renew and everything is exactly where you left it.
            </p>
            <Link href="/terms" className="text-xs font-semibold text-brand-700 hover:underline">Read the vendor terms</Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
