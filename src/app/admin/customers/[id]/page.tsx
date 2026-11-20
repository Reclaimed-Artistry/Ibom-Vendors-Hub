import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Phone, Users, Wallet, Clock } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { formatMoney, formatDate } from "@/lib/utils";
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui";

export const metadata: Metadata = { title: "Customer detail · Admin" };

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [customer, orders, transactions] = await Promise.all([
    systemDb.maybeOne<{
      id: string;
      full_name: string;
      email: string;
      phone: string | null;
      status: string;
      role: string;
      created_at: string;
      last_login_at: string | null;
    }>(
      `select id, full_name, email, phone, status, role, created_at, last_login_at
         from users where id = $1 and role = 'customer'`,
      [id],
    ),
    systemDb.query<{
      id: string;
      reference: string;
      status: string;
      payment_status: string;
      total: number;
      store_name: string;
      created_at: string;
    }>(
      `select o.id, o.reference, o.status, o.payment_status, o.total, o.created_at,
              s.name as store_name
         from orders o join stores s on s.id = o.store_id
        where o.customer_id = $1
        order by o.created_at desc limit 30`,
      [id],
    ),
    systemDb.query<{
      type: string;
      amount: number;
      reference: string;
      description: string | null;
      status: string;
      created_at: string;
    }>(
      `select t.type, t.amount, t.reference, t.description, t.status, t.created_at
         from wallet_transactions t
         join wallets w on w.id = t.wallet_id
        where w.user_id = $1
        order by t.created_at desc limit 30`,
      [id],
    ),
  ]);

  if (!customer) notFound();

  const walletRow = await systemDb.maybeOne<{ balance: number }>(
    `select coalesce(balance, 0) as balance from wallets where user_id = $1`,
    [id],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title={customer.full_name}
        description={customer.email}
        breadcrumb={<Link href="/admin/customers" className="hover:text-brand-700">← Customers</Link>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Wallet balance" value={formatMoney(Number(walletRow?.balance ?? 0))} icon={<Wallet className="size-4" />} />
        <StatCard label="Total orders" value={orders.length} hint="All time" icon={<Users className="size-4" />} />
        <StatCard label="Total spent" value={formatMoney(Number(
          orders.reduce((s, o) => s + (o.payment_status === "paid" ? Number(o.total) : 0), 0),
        ))} hint="Paid orders" icon={<Clock className="size-4" />} />
        <StatCard label="Status" value={customer.status.charAt(0).toUpperCase() + customer.status.slice(1)} hint="Account" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader title="Profile" />
          <div className="card-pad space-y-3">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700">
                <Users className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-900">{customer.full_name}</p>
                <p className="flex items-center gap-1.5 mt-0.5 text-sm text-ink-600">
                  <Mail className="size-3.5 shrink-0" /> {customer.email}
                </p>
                {customer.phone ? (
                  <p className="mt-0.5 text-sm text-ink-600">
                    <Phone className="size-3.5 shrink-0" /> {customer.phone}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-ink-400">
                  Registered {formatDate(customer.created_at)} &nbsp;·&nbsp;
                  {customer.last_login_at ? `Last seen ${formatDate(customer.last_login_at)}` : "Never signed in"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="font-medium text-ink-600">Account status</span>
              <Badge tone={customer.status === "active" ? "success" : "danger"}>
                {customer.status}
              </Badge>
              <span className="ml-auto text-xs text-ink-500">Role: {customer.role}</span>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Wallet activity" description={`Current balance: ${formatMoney(Number(walletRow?.balance ?? 0))}`} />
          <div className="card-pad pt-0">
            {transactions.length === 0 ? (
              <EmptyState
                icon={<Wallet className="size-5" />}
                title="No wallet activity"
                description="This customer has not funded their wallet or paid with it yet."
              />
            ) : (
              <ul className="divide-y divide-ink-100">
                {transactions.map((tx) => (
                  <li key={tx.reference ?? tx.created_at} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-900">
                        {tx.type === "credit" ? "Wallet top-up" : "Order paid with wallet"}
                      </p>
                      <p className="text-xs text-ink-500">{tx.reference} · {formatDate(tx.created_at)}</p>
                      {tx.description ? (
                        <p className="mt-0.5 text-xs text-ink-400">{tx.description}</p>
                      ) : null}
                    </div>
                    <span className={`font-semibold ${tx.type === "credit" ? "text-emerald-600" : "text-red-600"}`}>
                      {tx.type === "credit" ? "+" : "-"}{formatMoney(Number(tx.amount))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Recent orders" action={<Link href="/admin/payments" className="text-sm font-semibold text-brand-700 hover:underline">All payments</Link>} />
          <div className="card-pad pt-0">
            {orders.length === 0 ? (
              <p className="px-5 py-3 text-sm text-ink-500">No orders yet.</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {orders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-ink-900">{o.store_name}</span>
                      <p className="text-xs text-ink-500">{o.reference} · {formatDate(o.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-ink-500 capitalize">{o.payment_status}</span>
                      <span className="text-sm font-semibold">{formatMoney(Number(o.total))}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
