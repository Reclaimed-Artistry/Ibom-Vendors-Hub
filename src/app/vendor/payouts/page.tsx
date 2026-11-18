import type { Metadata } from "next";
import { CheckCircle2, Clock, Landmark, ShieldCheck, Wallet } from "lucide-react";
import { getVendorContext } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatDateTime, formatMoney } from "@/lib/utils";
import { Card, CardHeader, EmptyState, PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { RequestPayoutForm, VendorBankAccountForm } from "@/components/vendor-payout-forms";

export const metadata: Metadata = { title: "Wallet & Payouts · Vendor Dashboard" };

export default async function VendorPayoutsPage() {
  const ctx = await getVendorContext();
  const [settings, balance, profile, payouts] = await Promise.all([
    getSettings(),
    systemDb.maybeOne<{
      available_amount: number;
      pending_amount: number;
      lifetime_earned: number;
      lifetime_withdrawn: number;
    }>(
      `select coalesce(vb.available_amount, 0)::float8 as available_amount,
              coalesce(vb.pending_amount, 0)::float8 as pending_amount,
              coalesce(vb.lifetime_gross, 0)::float8 as lifetime_earned,
              coalesce((select sum(vp.amount) from vendor_payouts vp where vp.store_id = $1 and vp.status = 'paid'), 0)::float8 as lifetime_withdrawn
         from (select $1::uuid as store_id) s
         left join vendor_balances vb on vb.store_id = s.store_id`,
      [ctx.store.id],
    ),
    systemDb.maybeOne<{
      bank_name: string | null;
      account_number: string | null;
      account_name: string | null;
    }>(
      `select bank_name, account_number, account_name
         from vendor_profiles
        where user_id = $1`,
      [ctx.user.id],
    ),
    systemDb.query<{
      id: string;
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
      `select id, amount::float8 as amount, status, reference,
              bank_name, account_number, account_name, notes as note,
              created_at, processed_at
         from vendor_payouts
        where store_id = $1
        order by created_at desc
        limit 50`,
      [ctx.store.id],
    ),
  ]);

  const available = Number(balance?.available_amount ?? 0);
  const pending = Number(balance?.pending_amount ?? 0);
  const earned = Number(balance?.lifetime_earned ?? 0);
  const withdrawn = Number(balance?.lifetime_withdrawn ?? 0);
  const hasBankAccount = Boolean(profile?.bank_name && profile?.account_number && profile?.account_name);
  const bankSummary = hasBankAccount
    ? `${profile?.bank_name} · ${profile?.account_number} (${profile?.account_name})`
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wallet & Bank Payouts"
        description="Manage your Nigerian bank account for direct customer transfers. Direct transfers are not held by the platform."
      />

      {/* How Payments Work Explainer */}
      <div className="rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50/90 via-white to-emerald-50/70 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-700" />
          <div className="space-y-2 text-xs leading-5 text-ink-700">
            <p className="text-sm font-bold text-ink-900">How Customer Payments & Your Bank Payouts Work</p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>
                <strong>Customer pays by bank transfer</strong> directly into the vendor’s bank account. Verify the credit before approving the receipt. Direct transfers do not accrue platform escrow earnings.
              </li>
              <li><strong>Approve only after receiving funds:</strong> Receipt uploads are evidence for review, not proof that your bank account was credited.</li>
              <li><strong>Confirm fulfilment separately:</strong> Use the customer’s delivery or pickup PIN when the order is handed over.</li>
              <li>Wallet balances below apply only to eligible historical platform payments, not direct bank transfers.</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Wallet Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Available for payout"
          value={formatMoney(available)}
          hint="Unlocked & ready to withdraw"
          icon={<CheckCircle2 className="size-4 text-emerald-600" />}
        />
        <StatCard
          label="Pending in escrow"
          value={formatMoney(pending)}
          hint="Unlocks on 6-digit Delivery PIN"
          icon={<Clock className="size-4 text-amber-600" />}
        />
        <StatCard
          label="Lifetime earned"
          value={formatMoney(earned)}
          hint="Completed net earnings"
          icon={<Wallet className="size-4" />}
        />
        <StatCard
          label="Total paid to bank"
          value={formatMoney(withdrawn)}
          hint="Settled withdrawals"
          icon={<Landmark className="size-4" />}
        />
      </div>

      {/* Settlement Bank Account + Request Payout */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Settlement Bank Account"
            description="The Nigerian bank account where you receive your storefront payouts."
          />
          <div className="card-pad pt-0">
            <VendorBankAccountForm
              initialBankName={profile?.bank_name}
              initialAccountNumber={profile?.account_number}
              initialAccountName={profile?.account_name}
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Withdraw Available Balance"
            description="Transfer unlocked funds from your Ibom Vendors Hub wallet to your bank account."
          />
          <div className="card-pad pt-0">
            <RequestPayoutForm
              availableAmount={available}
              hasBankAccount={hasBankAccount}
              bankSummary={bankSummary}
            />
          </div>
        </Card>
      </div>

      {/* Payout History */}
      <Card>
        <CardHeader
          title="Payout History"
          description="All bank withdrawal requests and settlement transfer references."
        />
        {payouts.length === 0 ? (
          <EmptyState
            icon={<Landmark className="size-5" />}
            title="No payout withdrawals yet"
            description="Once paid orders are completed with the customer's 6-digit Delivery PIN, withdraw your available balance here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Requested</th>
                  <th>Destination Bank Account</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Transfer Ref / Note</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((row) => (
                  <tr key={row.id}>
                    <td className="text-xs text-ink-500">{formatDateTime(row.created_at)}</td>
                    <td className="text-xs">
                      {row.bank_name ? (
                        <div>
                          <p className="font-semibold text-ink-900">
                            {row.bank_name} · <span className="font-mono">{row.account_number}</span>
                          </p>
                          <p className="text-ink-500">{row.account_name}</p>
                        </div>
                      ) : (
                        <span className="text-ink-400">Saved bank account</span>
                      )}
                    </td>
                    <td className="font-semibold text-ink-900">{formatMoney(row.amount)}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="text-xs text-ink-600">
                      {row.reference ? <span className="font-mono font-semibold text-ink-900">{row.reference}</span> : "—"}
                      {row.note ? <p className="text-ink-500">{row.note}</p> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
