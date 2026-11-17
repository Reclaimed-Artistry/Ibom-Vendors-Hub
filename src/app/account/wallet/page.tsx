import type { Metadata } from "next";
import { Banknote, History, Wallet } from "lucide-react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { formatMoney, formatDate } from "@/lib/utils";
import {
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { getWalletBalance, getWalletTransactions } from "@/app/actions/wallet";
import { WalletFundForm } from "./fund-form";

export const metadata: Metadata = { title: "Wallet · Ibom Vendors Hub" };

export default async function WalletPage() {
  const user = await requireUser(["customer", "vendor", "admin", "super_admin"]);
  const [balance, transactions] = await Promise.all([
    getWalletBalance(user.id),
    getWalletTransactions(user.id, 50),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Wallet"
        description="Top up your prepaid wallet and use it to pay for orders at checkout instead of paying with PayStack each time."
        actions={
          <ButtonLink href="/browse" variant="secondary" size="sm">
            Browse marketplace
          </ButtonLink>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Wallet balance"
          value={formatMoney(balance)}
          hint="Available to spend at checkout"
          icon={<Wallet className="size-4" />}
        />
        <StatCard
          label="Topped up (lifetime)"
          value={formatMoney(
            Number(
              transactions
                .filter((t) => t.type === "credit" && t.status === "success")
                .reduce((s, t) => s + Number(t.amount), 0),
            ),
          )}
          icon={<Banknote className="size-4 text-emerald-600" />}
        />
        <StatCard
          label="Spent from wallet"
          value={formatMoney(
            Number(
              transactions
                .filter((t) => t.type === "debit" && t.status === "success")
                .reduce((s, t) => s + Number(t.amount), 0),
            ),
          )}
          icon={<Banknote className="size-4 text-amber-600" />}
        />
      </div>

      <Card>
        <CardHeader title="Fund your wallet" />
        <div className="card-pad">
          <WalletFundForm />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Wallet transactions"
          action={
            <Link href="/account/orders" className="text-sm font-semibold text-brand-700 hover:underline">
              My orders
            </Link>
          }
        />
        <div className="card-pad pt-0">
          {transactions.length === 0 ? (
            <EmptyState
              icon={<History className="size-5" />}
              title="No transactions yet"
              description="Fund your wallet to see top-ups and spends here."
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {transactions.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid size-7 shrink-0 place-items-center rounded-full ${
                        tx.type === "credit"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {tx.type === "credit" ? <Banknote className="size-3.5" /> : <Banknote className="size-3.5" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-900">
                        {tx.type === "credit" ? "Wallet top-up" : "Order paid with wallet"}
                      </p>
                      <p className="text-xs text-ink-500">
                        {tx.reference} · {formatDate(tx.created_at)}
                      </p>
                      {tx.description ? (
                        <p className="mt-0.5 text-xs text-ink-400">{tx.description}</p>
                      ) : null}
                    </div>
                  </div>
                  <span
                    className={`font-semibold whitespace-nowrap ${
                      tx.type === "credit" ? "text-emerald-600" : "text-ink-900"
                    }`}
                  >
                    {tx.type === "credit" ? "+" : "-"}{formatMoney(Number(tx.amount))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
