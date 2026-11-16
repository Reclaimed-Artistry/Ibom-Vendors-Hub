import type { Metadata } from "next";
import Link from "next/link";
import { Check, Clock, CreditCard, Lock, ShieldAlert, Sparkles } from "lucide-react";
import { getVendorContext } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import {
  getLatestStoreSubscription,
  getPlans,
  getStoreSubscription,
  hasPriorSubscription,
  subscriptionState,
} from "@/lib/subscriptions";
import { formatMoney, formatDate, formatDateTime } from "@/lib/utils";
import { Alert, Badge, Card, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { SubscriptionPurchaseForm } from "@/components/vendor-forms";
import { SubscriptionCountdown } from "@/components/subscription-countdown";

export const metadata: Metadata = { title: "Subscription · Vendor dashboard" };

function planIntervalSuffix(intervalMonths: number, durationDays: number) {
  if (intervalMonths === 12) return "/yr";
  if (intervalMonths === 3) return "/quarter";
  if (intervalMonths > 1) return `/${intervalMonths} mos`;
  if (intervalMonths === 1) return "/mo";
  return durationDays ? `/${durationDays}d` : "/mo";
}

export default async function VendorSubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ suspended?: string }>;
}) {
  const { suspended } = await searchParams;
  const { store, effectiveExpiresAt, effectiveStartedAt, isSubscriptionExpired } = await getVendorContext();
  const [subscription, lastSub, usedTrial, plans, payments] = await Promise.all([
    getStoreSubscription(store.id),
    getLatestStoreSubscription(store.id),
    hasPriorSubscription(store.id),
    getPlans(),
    systemDb.query<{
      reference: string;
      amount: number;
      status: string;
      plan_name: string | null;
      paid_at: string | null;
      created_at: string;
      provider: string;
    }>(
      `select p.reference, p.amount, p.status, sp.name as plan_name, p.paid_at, p.created_at, p.provider
         from payments p left join subscription_plans sp on sp.id = p.plan_id
        where p.store_id = $1 and p.scope = 'subscription'
        order by p.created_at desc limit 12`,
      [store.id],
    ),
  ]);
  const state = subscriptionState(subscription);
  const displaySub = subscription ?? lastSub;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Subscription & renewal"
        description="Your active subscription keeps your vendor account unlocked and your storefront online. Renew before your countdown ends to avoid suspension."
      />

      {isSubscriptionExpired ? (
        <div className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-100 text-red-700">
              <ShieldAlert className="size-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-ink-900">
                  {suspended === "1"
                    ? "Dashboard locked — renew your subscription to continue"
                    : "Your vendor account is currently suspended"}
                </h2>
                <Badge tone="danger">Suspended until renewal</Badge>
              </div>
              <p className="text-sm text-ink-600">
                {lastSub
                  ? `Your ${lastSub.plan.name} plan expired on ${formatDateTime(lastSub.expires_at)}. `
                  : "You do not have an active subscription. "}
                Until you renew a plan below, your vendor dashboard tools and public storefront (
                <span className="font-mono text-xs">/s/{store.slug}</span>) remain suspended.
              </p>
              <p className="text-xs text-ink-500">
                Nothing has been deleted — all your products, images, orders, customer records and storefront address are
                preserved and unlock automatically as soon as your renewal payment is verified.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <SubscriptionCountdown
        variant="hero"
        expiresAt={subscription?.expires_at ?? effectiveExpiresAt ?? lastSub?.expires_at ?? null}
        startedAt={subscription?.started_at ?? effectiveStartedAt ?? lastSub?.started_at ?? null}
        planName={
          subscription?.plan.name ??
          (effectiveExpiresAt && !subscription
            ? "Administrator access grant"
            : lastSub
              ? `${lastSub.plan.name} (expired)`
              : "No active subscription")
        }
        status={subscription?.status ?? lastSub?.status ?? null}
        isSuspendedForExpiry={isSubscriptionExpired}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Account status"
          value={isSubscriptionExpired ? "Suspended" : subscription?.plan.name ?? "Active"}
          hint={
            isSubscriptionExpired
              ? "Renew below to unlock account"
              : subscription
                ? `${subscription.status} · ${formatMoney(Number(subscription.plan.price))}`
                : "Admin access grant"
          }
          icon={isSubscriptionExpired ? <Lock className="size-4 text-red-600" /> : <Sparkles className="size-4" />}
        />
        <StatCard
          label="Days remaining"
          value={isSubscriptionExpired ? 0 : state.days}
          hint={
            subscription?.expires_at
              ? `Expires ${formatDate(subscription.expires_at)}`
              : effectiveExpiresAt
                ? `Valid until ${formatDate(effectiveExpiresAt)}`
                : lastSub?.expires_at
                  ? `Expired ${formatDate(lastSub.expires_at)}`
                  : "—"
          }
          icon={<Clock className="size-4" />}
        />
        <StatCard
          label="Product limit"
          value={subscription?.plan.product_limit ?? lastSub?.plan.product_limit ?? "—"}
          hint={subscription?.plan.product_limit == null && subscription ? "Unlimited listings" : "Upgrade for more listings"}
          icon={<CreditCard className="size-4" />}
        />
      </div>

      {!isSubscriptionExpired && state.days > 0 && state.days <= 5 ? (
        <Alert tone="warning" title={`Subscription expires in ${state.days} day${state.days === 1 ? "" : "s"}`}>
          Renew now so your account and storefront are not suspended when the countdown hits zero. Early renewals extend from your current expiry date — you never lose remaining days.
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <Card>
            <CardHeader
              title={isSubscriptionExpired ? "Choose a plan to unsuspend your account" : "Subscription plans"}
              description="Renewing early extends from your current expiry date. Renewing after expiry activates your account immediately from today."
            />
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {plans.map((plan) => {
                const isFreeTrial = Number(plan.price) <= 0 && plan.trial_days > 0;
                const trialExhausted = isFreeTrial && usedTrial;
                const current = subscription?.plan_id === plan.id;
                const wasPrevious = !subscription && lastSub?.plan_id === plan.id && !isFreeTrial;
                return (
                  <div
                    key={plan.id}
                    className={`flex flex-col justify-between rounded-2xl border p-4 ${
                      current
                        ? "border-brand-400 bg-brand-50/50"
                        : wasPrevious
                          ? "border-brand-300 bg-brand-50/30"
                          : "border-ink-100 bg-white"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-ink-900">{plan.name}</p>
                          <p className="text-xs text-ink-500">
                            {plan.duration_days} days · {plan.product_limit ? `${plan.product_limit} products` : "Unlimited products"}
                          </p>
                        </div>
                        {current ? (
                          <Badge tone="success">{subscription?.status === "trialing" ? "Current trial" : "Current"}</Badge>
                        ) : wasPrevious ? (
                          <Badge tone="warning">Previous plan</Badge>
                        ) : trialExhausted ? (
                          <Badge tone="neutral">Trial used</Badge>
                        ) : plan.is_featured ? (
                          <Badge tone="info">Popular</Badge>
                        ) : null}
                      </div>
                      <p className="mt-3 text-2xl font-bold text-ink-900">
                        {Number(plan.price) === 0 ? "Free trial" : formatMoney(Number(plan.price))}
                        {Number(plan.price) > 0 ? (
                          <span className="text-sm font-normal text-ink-400">
                            {planIntervalSuffix(plan.interval_months, plan.duration_days)}
                          </span>
                        ) : null}
                      </p>
                      <ul className="mt-3 space-y-1.5 text-sm text-ink-600">
                        {(plan.features ?? []).map((feature) => (
                          <li key={feature} className="flex items-start gap-1.5">
                            <Check className="mt-0.5 size-3.5 shrink-0 text-brand-600" /> {feature}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-4">
                      {trialExhausted ? (
                        <button
                          type="button"
                          disabled
                          className="btn btn-secondary w-full cursor-not-allowed opacity-60"
                        >
                          {current ? "Free trial active" : "One-time trial used"}
                        </button>
                      ) : (
                        <SubscriptionPurchaseForm
                          planId={plan.id}
                          label={
                            current
                              ? "Extend this plan"
                              : wasPrevious
                                ? "Renew this plan"
                                : isSubscriptionExpired
                                  ? `Renew with ${plan.name}`
                                  : Number(plan.price) === 0
                                    ? "Start free trial"
                                    : "Choose plan"
                          }
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHeader title="Payment history" description="Subscription payments for this store." />
            {payments.length === 0 ? (
              <EmptyState icon={<CreditCard className="size-5" />} title="No subscription payments yet" description="Your subscription payments and renewals will appear here." />
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
                        <td>
                          <Badge tone={payment.status === "success" ? "success" : payment.status === "failed" ? "danger" : "warning"}>
                            {payment.status}
                          </Badge>
                        </td>
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
            <div className="flex justify-between text-sm">
              <span className="text-ink-500">Plan</span>
              <span className="font-medium">{displaySub?.plan.name ?? "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-500">Account status</span>
              <span className={`font-semibold capitalize ${isSubscriptionExpired ? "text-red-600" : "text-brand-700"}`}>
                {isSubscriptionExpired ? "Suspended (expired)" : subscription?.status ?? "active"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-500">Started</span>
              <span className="font-medium">{formatDate(displaySub?.started_at)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-500">{isSubscriptionExpired ? "Expired on" : "Expires on"}</span>
              <span className="font-medium">{formatDateTime(displaySub?.expires_at ?? effectiveExpiresAt)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-500">Auto renew</span>
              <span className="font-medium">{subscription?.auto_renew ? "On" : "Off"}</span>
            </div>
            <p className="pt-2 text-xs text-ink-400">
              Commission on sales is 5%. Payments are verified server-side with the payment gateway before your subscription is extended.
            </p>
          </Card>

          <Card className="card-pad space-y-2">
            <p className="text-sm font-semibold text-ink-900">What happens when my subscription expires?</p>
            <p className="text-sm text-ink-500">
              When your countdown hits zero, your vendor account and public storefront are automatically suspended until
              you renew your subscription. Nothing is deleted — your products, images, orders and customer records stay
              safe and are restored immediately once you renew.
            </p>
            <Link href="/terms" className="text-xs font-semibold text-brand-700 hover:underline">
              Read the vendor terms
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
