import Link from "next/link";
import { CheckCircle2, Clock, Landmark, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { redirect } from "next/navigation";
import { transferSelect, type ManualTransfer } from "@/lib/manual-payments";
import { CopyAccount, ReceiptUploadForm, TransferCountdown, TransferStatusRefresh } from "@/components/manual-transfer-forms";
import { Logo } from "@/components/logo";
import { formatMoney } from "@/lib/utils";

export async function ManualPaymentPortal({ reference, payerId, currency }: { reference: string; payerId: string | null; currency: string }) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/pay/${reference}`)}`);
  if (user.id !== payerId) return <div className="container-page py-16"><h1 className="text-xl font-bold">This payment belongs to another customer.</h1></div>;
  const transfers = await systemDb.query<ManualTransfer>(`${transferSelect} where p.reference=$1 and m.customer_id=$2 order by m.created_at, m.id`, [reference, user.id]);
  return <main className="min-h-screen bg-ink-50 py-10">
    <TransferStatusRefresh />
    <div className="container-page max-w-3xl space-y-6">
      <div className="flex justify-center"><Logo height={48} /></div>
      <header className="text-center"><p className="text-xs font-semibold uppercase tracking-widest text-brand-700">Ibomvendorshub · Bank transfer</p><h1 className="mt-2 font-display text-3xl text-ink-900">Complete your payment</h1><p className="mt-2 text-sm text-ink-500">Transfer to the vendor, upload your receipt, and follow your approval here.</p></header>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><ShieldCheck className="mb-1 size-5" />These payments go directly to each vendor, not platform escrow. Confirm the account name in your bank app. Never share your bank password, PIN or OTP.</div>
      {transfers.length > 1 ? <p className="text-sm text-ink-600">Your cart contains multiple vendors. Transfer each exact amount separately and upload a receipt for each vendor. Each vendor approves only their own order.</p> : null}
      {transfers.map((transfer) => <section key={transfer.id} className="card card-pad space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-ink-900">{transfer.store_name}</h2><p className="text-xs text-ink-400">{transfer.order_reference}</p></div><p className="text-2xl font-bold text-brand-800">{formatMoney(Number(transfer.amount), currency)}</p></div>
        {transfer.status === "approved" ? <div className="rounded-xl border border-brand-200 bg-brand-50 p-5 text-brand-900"><CheckCircle2 className="mb-2 size-8" /><h3 className="text-xl font-bold">Approved</h3><p className="mt-1 text-sm">The vendor confirmed your payment. Your order can now be fulfilled.</p></div> : transfer.status === "awaiting_approval" ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900"><Clock className="mb-2 size-7" /><h3 className="text-lg font-bold">Awaiting payment approval</h3><p className="mt-1 text-sm">Your receipt was submitted. The vendor has been asked to check the money arrived. This page updates automatically. Do not pay again.</p></div> : <>
          <TransferCountdown expiresAt={transfer.expires_at} />
          {transfer.status === "rejected" ? <div className="rounded-xl bg-red-50 p-4 text-sm text-red-800"><strong>Receipt needs attention</strong><p>{transfer.review_note}</p><p className="mt-1">Contact the vendor if money has left your account. You may submit a corrected receipt. Do not pay twice.</p></div> : null}
          <div className="rounded-2xl border border-ink-200 bg-white p-5"><p className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink-500"><Landmark className="size-4" /> Vendor bank account</p><dl className="space-y-3 text-sm"><div><dt className="text-xs text-ink-400">Bank</dt><dd className="font-semibold">{transfer.bank_name}</dd></div><div><dt className="text-xs text-ink-400">Account name</dt><dd className="font-semibold">{transfer.account_name}</dd></div><div><dt className="text-xs text-ink-400">Account number</dt><dd className="flex items-center justify-between gap-3"><span className="font-mono text-2xl font-bold tracking-widest">{transfer.account_number}</span><CopyAccount account={transfer.account_number} /></dd></div><div><dt className="text-xs text-ink-400">Transfer narration</dt><dd className="font-mono font-semibold">{transfer.order_reference}</dd></div></dl></div>
          <ReceiptUploadForm transferId={transfer.id} />
        </>}
        {transfer.submitted_at ? <a href={`/api/payment-receipts/${transfer.id}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-800 underline">View submitted receipt</a> : null}
        <Link href={`/account/orders/${transfer.order_id}`} className="block text-sm font-semibold text-brand-800">View order →</Link>
      </section>)}
      {!transfers.length ? <p>No bank transfers are associated with this payment.</p> : null}
      <Link href="/account/orders" className="block text-center text-sm font-semibold text-brand-800">Back to my orders</Link>
    </div>
  </main>;
}
