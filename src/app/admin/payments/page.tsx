import type { Metadata } from "next";
import Link from "next/link";
import { Landmark, Mail, Search, Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getPaymentStats, listRefunds } from "@/lib/payments";
import { gatewayStatus, getSettings } from "@/lib/settings";
import { systemDb } from "@/lib/db";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { Alert, Badge, Card, CardHeader, EmptyState, PageHeader, StatCard, StatusBadge, Tabs } from "@/components/ui";
import { RefundForm, VerifyPaystackButton } from "@/components/admin-forms";
import { AdminPayoutSettlementControls } from "@/components/admin-payout-row";

export const metadata: Metadata = { title: "Payments · Admin" };

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; status?: string; q?: string }>;
}) {
  await requireAdmin();
  const { scope = "all", status = "all", q } = await searchParams;

  const params: unknown[] = [];
  const filters: string[] = [];
  if (scope !== "all") {
    params.push(scope);
    filters.push(`p.scope = $${params.length}`);
  }
  if (status !== "all") {
    params.push(status);
    filters.push(`p.status = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    filters.push(`(p.reference ilike $${params.length} or p.payer_email ilike $${params.length} or p.provider_reference ilike $${params.length})`);
  }
  const where = filters.length ? `where ${filters.join(" and ")}` : "";

  const gateway = gatewayStatus(await getSettings());

  const [rows, stats, refunds, vendorPayouts] = await Promise.all([
    systemDb.query<{
      reference: string;
      scope: string;
      provider: string;
      amount: number;
      currency: string;
      status: string;
      payer_email: string;
      store_name: string | null;
      order_reference: string | null;
      created_at: string;
      paid_at: string | null;
    }>(
      `select p.reference, p.scope, p.provider, p.amount, p.currency, p.status, p.payer_email,
              s.name as store_name, o.reference as order_reference, p.created_at, p.paid_at
         from payments p left join stores s on s.id = p.store_id left join orders o on o.id = p.order_id
        ${where} order by p.created_at desc limit 60`,
      params,
    ),
    getPaymentStats(),
    listRefunds(),
    systemDb.query<{
      id: string;
      store_id: string;
      store_name: string;
      amount: number;
      status: string;
      reference: string | null;
      bank_name: string | null;
      account_number: string | null;
      account_name: string | null;
      note: string | null;
      created_at: string;
      processed_at: string | null;
    }>(
      `select p.id, p.store_id, s.name as store_name, p.amount::float8 as amount, p.status, p.reference,
              coalesce(p.bank_name, vp.bank_name) as bank_name,
              coalesce(p.account_number, vp.account_number) as account_number,
              coalesce(p.account_name, vp.account_name) as account_name,
              p.note, p.created_at, p.processed_at
         from vendor_payouts p
         join stores s on s.id = p.store_id
         left join vendor_profiles vp on vp.user_id = s.owner_id
        order by case when p.status = 'pending' then 0 else 1 end, p.created_at desc
        limit 40`,
    ),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader title="Payments" description="Every attempt, with server-side verification. Refunds are recorded in the audit log." />

      <Alert
        tone={gateway.mode === "paystack" && gateway.warnings.length === 0 ? "success" : gateway.secretConfigured ? "warning" : "info"}
        title={`Gateway: ${gateway.mode === "paystack" ? "Paystack" : "sandbox"} (${gateway.secretKind === "live" ? "live keys" : gateway.secretKind === "test" ? "test keys" : "no secret key"})`}
      >
        <span className="block">
          Public key: {gateway.publicConfigured ? `${gateway.publicHint} from ${gateway.publicSource}` : "not configured"} · Secret key:{" "}
          {gateway.secretConfigured ? `configured in ${gateway.secretSource}` : "not configured"}
        </span>
        {gateway.warnings.map((warning) => (
          <span key={warning} className="mt-1 block text-xs">{warning}</span>
        ))}
        <span className="mt-1 block text-xs">
          Paystack dashboard → Settings → API Keys &amp; Webhooks; the webhook URL is{" "}
          <span className="font-mono">/api/webhooks/paystack</span> and must use the same test/live mode as the keys.
        </span>
        {gateway.secretConfigured ? <div className="mt-2"><VerifyPaystackButton /></div> : null}
      </Alert>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Collected" value={formatMoney(Number(stats?.total_volume ?? 0))} hint={`${stats?.success_count ?? 0} successful payments`} icon={<Wallet className="size-4" />} />
        <StatCard label="Pending payouts" value={vendorPayouts.filter((p) => p.status === "pending").length} hint="Vendor bank withdrawals" icon={<Landmark className="size-4" />} />
        <StatCard label="Failed" value={stats?.failed_count ?? 0} hint="Declined or abandoned" />
        <StatCard label="Refund requests" value={refunds.filter((refund) => refund.status === "requested").length} hint="Need review" />
      </div>

      {/* Vendor Payout Requests */}
      <Card>
        <CardHeader
          title="Vendor Bank Payout Requests"
          description="Settle unlocked escrow earnings directly to each vendor's verified Nigerian bank account and record the transfer reference."
        />
        {vendorPayouts.length === 0 ? (
          <EmptyState
            icon={<Landmark className="size-5" />}
            title="No vendor payout requests yet"
            description="When vendors withdraw unlocked escrow funds from /vendor/payouts, their bank account details appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Storefront</th>
                  <th>Destination Bank Account</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Requested</th>
                  <th>Settlement Action</th>
                </tr>
              </thead>
              <tbody>
                {vendorPayouts.map((payout) => (
                  <tr key={payout.id}>
                    <td>
                      <Link href={`/admin/vendors/${payout.store_id}`} className="font-semibold text-ink-900 hover:text-brand-800">
                        {payout.store_name}
                      </Link>
                      {payout.note ? <p className="text-xs text-ink-500">{payout.note}</p> : null}
                    </td>
                    <td className="text-xs">
                      {payout.bank_name ? (
                        <div>
                          <p className="font-semibold text-ink-900">
                            {payout.bank_name} · <span className="font-mono">{payout.account_number}</span>
                          </p>
                          <p className="text-ink-500">{payout.account_name}</p>
                        </div>
                      ) : (
                        <span className="text-ink-400">No bank account saved</span>
                      )}
                    </td>
                    <td className="font-semibold text-ink-900">{formatMoney(payout.amount)}</td>
                    <td>
                      <StatusBadge status={payout.status} />
                    </td>
                    <td className="text-xs text-ink-500">{formatDateTime(payout.created_at)}</td>
                    <td>
                      {payout.status === "pending" || payout.status === "processing" ? (
                        <AdminPayoutSettlementControls payoutId={payout.id} />
                      ) : (
                        <span className="font-mono text-xs text-ink-600">{payout.reference ?? "Settled"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Tabs
        links={[
          { href: "/admin/payments", label: "All", active: scope === "all" && status === "all" },
          { href: "/admin/payments?status=success", label: "Successful", active: status === "success" },
          { href: "/admin/payments?status=pending", label: "Pending", active: status === "pending" },
          { href: "/admin/payments?status=failed", label: "Failed", active: status === "failed" },
          { href: "/admin/payments?scope=subscription", label: "Subscriptions", active: scope === "subscription" },
          { href: "/admin/payments?scope=order", label: "Orders", active: scope === "order" },
        ]}
      />

      <form className="card card-pad flex flex-wrap items-end gap-3" action="/admin/payments">
        <label className="min-w-56 flex-1">
          <span className="label">Search payments</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <input name="q" defaultValue={q ?? ""} className="input pl-9" placeholder="Reference, payer email or gateway reference" />
          </span>
        </label>
        <button type="submit" className="btn btn-secondary">Search</button>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={<Wallet className="size-5" />} title="No payments" description="Payments appear here as customers check out." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Scope</th>
                <th>Payer</th>
                <th>Store / order</th>
                <th>Status</th>
                <th className="text-right">Amount</th>
                <th>Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((payment) => (
                <tr key={payment.reference}>
                  <td>
                    <p className="font-mono text-xs text-ink-800">{payment.reference}</p>
                    <p className="text-[11px] text-ink-400">{payment.provider}</p>
                  </td>
                  <td className="text-sm capitalize">{payment.scope}</td>
                  <td className="text-xs text-ink-600"><span className="flex items-center gap-1"><Mail className="size-3" /> {payment.payer_email}</span></td>
                  <td className="text-xs">
                    {payment.store_name ? <Link href={`/admin/payments?q=${encodeURIComponent(payment.store_name)}`} className="text-ink-700 hover:text-brand-700">{payment.store_name}</Link> : "—"}
                    {payment.order_reference ? <p className="text-ink-400">{payment.order_reference}</p> : null}
                  </td>
                  <td><Badge tone={payment.status === "success" ? "success" : payment.status === "failed" ? "danger" : payment.status === "refunded" ? "neutral" : "warning"}>{payment.status}</Badge></td>
                  <td className="text-right font-semibold">{formatMoney(Number(payment.amount), payment.currency)}</td>
                  <td className="text-xs text-ink-500">{formatDateTime(payment.paid_at ?? payment.created_at)}</td>
                  <td>
                    {payment.status === "success" ? <RefundForm reference={payment.reference} amount={Number(payment.amount)} /> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Card>
        <CardHeader title="Refund requests" description="Created when vendors or customers request a refund." />
        {refunds.length === 0 ? (
          <p className="px-5 py-3 text-sm text-ink-500">No refund requests.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {refunds.slice(0, 12).map((refund) => (
              <li key={refund.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
                <div>
                  <p className="font-medium text-ink-800">{formatMoney(Number(refund.amount))} · {refund.reason ?? "No reason given"}</p>
                  <p className="text-xs text-ink-400">{formatDateTime(refund.created_at)}</p>
                </div>
                <Badge tone={refund.status === "processed" ? "success" : refund.status === "rejected" ? "danger" : "warning"}>{refund.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
