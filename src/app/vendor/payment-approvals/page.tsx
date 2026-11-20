import { requireActiveVendorContext } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { transferSelect, type ManualTransfer } from "@/lib/manual-payments";
import { TransferStatusRefresh, TransferReviewForm } from "@/components/manual-transfer-forms";
import { PageHeader, Badge } from "@/components/ui";
import { formatMoney, formatDateTime } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";
export default async function PaymentApprovalsPage() {
  const { store } = await requireActiveVendorContext();
  const rows = await systemDb.query<ManualTransfer>(`${transferSelect} where m.store_id=$1 and m.submitted_at is not null order by (m.status='awaiting_approval') desc, m.submitted_at desc limit 100`, [store.id]);
  return <div className="space-y-5"><TransferStatusRefresh />
    <PageHeader title="Payment approvals" description="Review customer receipts and confirm the exact credit in your own bank account. A receipt may be forged: never approve from the screenshot alone." />
    <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">These transfers are already paid directly to you. They do not increase your platform wallet or create a second payout. <Link href="/vendor/payouts" className="font-semibold underline">Manage bank details</Link></p>
    {!rows.length ? <div className="card card-pad text-sm text-ink-500">No receipts to review yet. New submissions appear here and trigger an email notification.</div> : null}
    {rows.map((row) => <section key={row.id} className="card card-pad space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><Link href={`/vendor/orders/${row.order_id}`} className="text-lg font-bold text-ink-900">{row.order_reference}</Link><p className="text-sm text-ink-500">{row.customer_name} · {formatDateTime(row.submitted_at)}</p></div><Badge tone={row.status === "approved" ? "success" : "warning"}>{row.status === "approved" ? "Approved" : row.status === "rejected" ? "Rejected" : "Awaiting payment approval"}</Badge></div>
      <p className="text-2xl font-bold text-brand-800">{formatMoney(Number(row.amount))}</p>
      <p className="text-xs text-ink-500">Expected account: {row.bank_name} · {row.account_number} · {row.account_name}</p>
      {row.submitted_at && new Date(row.submitted_at) > new Date(row.expires_at) ? <p className="text-xs font-semibold text-amber-800">Receipt was uploaded after the 20-minute transfer window. Check the bank transaction time carefully.</p> : null}
      <a href={`/api/payment-receipts/${row.id}`} target="_blank" rel="noreferrer" className="btn-secondary">View / download receipt</a>
      {row.review_note ? <p className="text-sm text-ink-600">Review note: {row.review_note}</p> : null}
      {row.status === "awaiting_approval" ? <TransferReviewForm transferId={row.id} /> : null}
    </section>)}
  </div>;
}
