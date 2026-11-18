import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { getPaymentContext, verifyPayment } from "@/lib/payments";
import { getSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/utils";
import { Alert } from "@/components/ui";
import { Logo } from "@/components/logo";
import { verifyPaymentAction } from "@/app/actions/payments";

export const metadata = { title: "Payment status" };
export const dynamic = "force-dynamic";

export default async function PaymentCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; error?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const settings = await getSettings();
  let context = sp.reference ? await getPaymentContext(sp.reference) : null;
  if (context?.payment.provider === "manual" && context.payment.scope === "order") redirect(`/pay/${context.payment.reference}`);
  let verificationError: string | null = null;

  if (context && context.payment.status === "pending" && context.payment.provider === "paystack") {
    // Never trust the redirect: verify with the gateway before showing success.
    try {
      await verifyPayment(sp.reference!);
      context = await getPaymentContext(sp.reference!);
    } catch (error) {
      verificationError = error instanceof Error ? error.message : "Verification failed";
    }
  }

  if (!context) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <XCircle className="mx-auto size-10 text-red-500" />
        <h1 className="mt-3 text-xl font-bold">Payment reference not found</h1>
        <Link href="/" className="btn-primary mt-5">Back to marketplace</Link>
      </div>
    );
  }

  const { payment, orders } = context;
  const money = (value: number) => formatMoney(value, payment.currency, settings.currency_symbol);
  const success = payment.status === "success";
  const pending = payment.status === "pending";

  return (
    <div className="min-h-screen bg-ink-50 py-10">
      <div className="mx-auto max-w-lg px-4">
        <div className="mb-6 flex justify-center"><Logo height={52} /></div>
        <div className="card card-pad text-center">
          {success ? (
            <>
              <CheckCircle2 className="mx-auto size-12 text-brand-600" />
              <h1 className="mt-3 text-2xl font-bold text-ink-900">Payment confirmed</h1>
              <p className="mt-1 text-sm text-ink-500">
                {money(Number(payment.amount))} verified for {payment.scope === "subscription" ? "your subscription" : "your order"}.
              </p>
            </>
          ) : pending ? (
            <>
              <Clock className="mx-auto size-12 text-amber-500" />
              <h1 className="mt-3 text-2xl font-bold">Payment pending</h1>
              <p className="mt-1 text-sm text-ink-500">
                We have not received a verified confirmation yet. If you have completed payment, give it a moment and refresh.
              </p>
            </>
          ) : (
            <>
              <XCircle className="mx-auto size-12 text-red-500" />
              <h1 className="mt-3 text-2xl font-bold">Payment not completed</h1>
              <p className="mt-1 text-sm text-ink-500">{payment.failure_reason ?? verificationError ?? "The payment was not successful."}</p>
            </>
          )}

          <div className="mt-5 rounded-xl bg-ink-50 p-3 text-left text-sm">
            <p className="flex justify-between"><span className="text-ink-500">Reference</span><span className="font-medium">{payment.reference}</span></p>
            <p className="mt-1 flex justify-between"><span className="text-ink-500">Amount</span><span className="font-medium">{money(Number(payment.amount))}</span></p>
            <p className="mt-1 flex justify-between"><span className="text-ink-500">Status</span><span className="font-medium capitalize">{payment.status}</span></p>
          </div>

          {success && orders.length ? (
            <div className="mt-5 space-y-3 text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Your orders</p>
              {orders.map((order) => (
                <div key={order.id} className="rounded-xl border border-ink-100 p-3">
                  <p className="text-sm font-semibold text-ink-900">{order.store_name}</p>
                  <p className="text-xs text-ink-400">{order.reference} · {money(Number(order.total))}</p>
                  <Link
                    href={`/track?reference=${order.reference}&contact=${encodeURIComponent(payment.payer_email)}`}
                    className="mt-2 inline-block text-xs font-semibold text-brand-800 hover:text-brand-900"
                  >
                    Track this order →
                  </Link>
                </div>
              ))}
            </div>
          ) : null}

          {success && payment.scope === "subscription" ? (
            <div className="mt-5">
              <Alert tone="success">Your storefront is live again. Renewals activate instantly after verified payment.</Alert>
              <Link href="/vendor/subscription" className="btn-primary mt-3 w-full">View subscription</Link>
            </div>
          ) : null}

          {pending ? (
            <div className="mt-5 space-y-2">
              <form action={verifyPaymentAction}>
                <input type="hidden" name="reference" value={payment.reference} />
                <button className="btn-primary w-full">Check payment status again</button>
              </form>
              {payment.provider === "sandbox" ? (
                <Link href={`/pay/${payment.reference}`} className="btn-secondary w-full">Complete the payment</Link>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href={success && payment.scope === "subscription" ? "/vendor" : "/"} className="btn-secondary">
              {success && payment.scope === "subscription" ? "Vendor dashboard" : "Marketplace home"}
            </Link>
            {success ? <Link href="/account/orders" className="btn-ghost">My orders</Link> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
