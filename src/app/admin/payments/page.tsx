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
import { AdminPayoutSettlementControls, AdminRefundDecisionControls } from "@/components/admin-payout-row";

export const metadata: Metadata = { title: "Payments · Admin" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  const [rows, stats, refunds, vendorPayouts, vendorWallets] = await Promise.all([
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
              p.notes as note, p.created_at, p.processed_at
         from vendor_payouts p
         join stores s on s.id = p.store_id
         left join vendor_profiles vp on vp.user_id = s.owner_id
        order by case when p.status = 'pending' then 0 else 1 end, p.created_at desc
        limit 40`,
    ),
    systemDb.query<{
      store_id: string;
      store_name: string;
      store_status: string;
      pending_amount: number;
      available_amount: number;
      lifetime_gross: number;
      paid_out: number;
      bank_name: string | null;
      account_number: string | null;
      account_name: string | null;
    }>(
      `select s.id as store_id,
              s.name as store_name,
              s.status as store_status,
              coalesce(vb.pending_amount, 0)::float8 as pending_amount,
              coalesce(vb.available_amount, 0)::float8 as available_amount,
              coalesce(vb.lifetime_gross, 0)::float8 as lifetime_gross,
              coalesce((select sum(vp2.amount) from vendor_payouts vp2 where vp2.store_id = s.id and vp2.status = 'paid'), 0)::float8 as paid_out,
              vp.bank_name,
              vp.account_number,
              vp.account_name
         from stores s
         left join vendor_balances vb on vb.store_id = s.id
         left join vendor_profiles vp on vp.user_id = s.owner_id
        order by coalesce(vb.available_amount, 0) desc, coalesce(vb.pending_amount, 0) desc, s.created_at desc
        limit 40`,
    ),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader title="Payments" description="Every attempt, with server-side verification, vendor escrow balances, and bank payouts." />

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

      {/* Vendor Escrow Balances & Saved Bank Accounts */}
      {vendorWallets.length > 0 ? (
        <Card>
          <CardHeader
            title="Vendor Escrow Wallets & Settlement Bank Accounts"
            description="Live escrow balances and saved Nigerian bank accounts across registered storefronts."
          />
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Storefront</th>
                  <th>Saved Bank Account</th>
                  <th className="text-right">Pending Escrow</th>
                  <th className="text-right">Available for Payout</th>
                  <th className="text-right">Paid Out</th>
                </tr>
              </thead>
              <tbody>
                {vendorWallets.map((wallet) => (
                  <tr key={wallet.store_id}>
                    <td>
                      <Link href={`/admin/vendors/${wallet.store_id}`} className="font-semibold text-ink-900 hover:text-brand-800">
                        {wallet.store_name}
                      </Link>
                      <div className="mt-0.5"><StatusBadge status={wallet.store_status} /></div>
                    </td>
                    <td className="text-xs">
                      {wallet.bank_name && wallet.account_number ? (
                        <div>
                          <p className="font-semibold text-ink-900">
                            {wallet.bank_name} · <span className="font-mono">{wallet.account_number}</span>
                          </p>
                          <p className="text-ink-500">{wallet.account_name}</p>
                        </div>
                      ) : (
                        <span className="text-ink-400">Not added yet</span>
                      )}
                    </td>
                    <td className="text-right text-sm font-medium text-amber-700">{formatMoney(wallet.pending_amount)}</td>
                    <td className="text-right text-sm font-semibold text-emerald-700">{formatMoney(wallet.available_amount)}</td>
                    <td className="text-right text-sm text-ink-600">{formatMoney(wallet.paid_out)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

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
        <label className="min-w-0 w-full flex-1 sm:w-auto sm:min-w-56">
          <span className="label">Search payments</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <input name="q" defaultValue={q ?? ""} className="input pl-9" placeholder="Reference, payer email or gateway reference" />
          </span>
        </label>
        <button type="submit" className="btn btn-secondary">Search</button>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={<Wallet className="size-5" />} title="No payments" description="Payments appear here as customers check out or vendors renew subscriptions." />
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
                  <p className="font-medium text-ink-800">
                    {formatMoney(Number(refund.amount))} · {refund.reason ?? "No reason given"}
                    {refund.store_name ? <span className="text-ink-500"> · {refund.store_name}</span> : null}
                  </p>
                  <p className="text-xs text-ink-400">{formatDateTime(refund.created_at)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={refund.status === "processed" ? "success" : refund.status === "rejected" ? "danger" : "warning"}>{refund.status}</Badge>
                  {refund.status === "requested" ? <AdminRefundDecisionControls refundId={refund.id} /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
