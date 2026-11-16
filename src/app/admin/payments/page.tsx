import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Search, Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getPaymentStats, listRefunds } from "@/lib/payments";
import { gatewayStatus, getSettings } from "@/lib/settings";
import { systemDb } from "@/lib/db";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { Alert, Badge, Card, CardHeader, EmptyState, PageHeader, StatCard, Tabs } from "@/components/ui";
import { RefundForm } from "@/components/admin-forms";

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

  const [rows, stats, refunds] = await Promise.all([
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
      </Alert>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Collected" value={formatMoney(Number(stats?.total_volume ?? 0))} hint={`${stats?.success_count ?? 0} successful payments`} icon={<Wallet className="size-4" />} />
        <StatCard label="Pending" value={stats?.pending_count ?? 0} hint="Awaiting confirmation" />
        <StatCard label="Failed" value={stats?.failed_count ?? 0} hint="Declined or abandoned" />
        <StatCard label="Refund requests" value={refunds.filter((refund) => refund.status === "requested").length} hint="Need review" />
      </div>

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
