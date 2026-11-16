import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { getPaymentContext } from "@/lib/payments";
import { getSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/utils";
import { confirmSandboxPaymentAction } from "@/app/actions/payments";
import { Logo } from "@/components/logo";

export const metadata = { title: "Secure payment" };

export default async function PayPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const context = await getPaymentContext(reference);
  if (!context) notFound();
  const { payment, orders, plan, store } = context;
  const settings = await getSettings();
  const money = (value: number) => formatMoney(value, payment.currency, settings.currency_symbol);

  if (payment.status === "success") redirect(`/pay/callback?reference=${encodeURIComponent(reference)}`);
  if (payment.status === "refunded") {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <AlertCircle className="mx-auto size-10 text-red-500" />
        <h1 className="mt-3 text-xl font-bold">This payment was refunded</h1>
        <Link href="/" className="btn-primary mt-5">Back to marketplace</Link>
      </div>
    );
  }

  const isSandbox = payment.provider === "sandbox";

  return (
    <div className="min-h-screen bg-ink-50 py-10">
      <div className="mx-auto max-w-lg px-4">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <div className="card card-pad">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
            <LockKeyhole className="size-3.5" /> Secure checkout
          </div>
          <p className="mt-3 text-sm text-ink-500">{store ? store.name : payment.scope === "subscription" ? "Subscription payment" : "Marketplace order"}</p>
          <p className="mt-1 text-3xl font-bold text-ink-900">{money(Number(payment.amount))}</p>
          <p className="mt-1 text-xs text-ink-400">Reference {payment.reference}</p>

          <div className="mt-5 rounded-xl border border-ink-100 bg-ink-50/60 p-3 text-xs text-ink-500">
            {payment.scope === "subscription" ? (
              <p>{plan ? `${plan.name} · ${plan.duration_days} days of storefront access` : "Store subscription"}</p>
            ) : (
              <ul className="space-y-1">
                {orders.map((order) => (
                  <li key={order.id} className="flex justify-between gap-3">
                    <span>{order.store_name} · {order.reference}</span>
                    <span className="font-medium">{money(Number(order.total))}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {isSandbox ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
                <p className="font-semibold">Sandbox gateway</p>
                <p className="mt-1">
                  No Paystack keys are configured, so this is a simulated payment. It still goes through server-side
                  verification: the persisted payment record is checked and the amount is validated before any order is
                  marked paid.
                </p>
              </div>
              <form action={confirmSandboxPaymentAction}>
                <input type="hidden" name="reference" value={payment.reference} />
                <button className="btn-primary w-full">Pay {money(Number(payment.amount))} now</button>
              </form>
            </div>
          ) : payment.authorization_url ? (
            <a href={payment.authorization_url} className="btn-primary mt-5 w-full">Continue to Paystack</a>
          ) : (
            <p className="mt-5 text-sm text-ink-500">This payment could not be initialised. Please return to checkout.</p>
          )}

          <Link href="/checkout" className="mt-3 block text-center text-xs font-medium text-ink-500 hover:text-ink-800">
            Cancel and return
          </Link>
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-ink-400">
          <ShieldCheck className="size-3.5" /> Payments are verified server-side. A browser redirect alone never marks an order as paid.
        </p>
      </div>
    </div>
  );
}
