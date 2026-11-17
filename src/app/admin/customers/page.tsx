import type { Metadata } from "next";
import Link from "next/link";
import { Users, Search, Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { formatMoney, formatDate } from "@/lib/utils";
import { Badge, Card, CardHeader, EmptyState, Field, PageHeader, StatCard } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export const metadata: Metadata = { title: "Customers · Admin" };

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const { q = "" } = await searchParams;

  const [stats, customers] = await Promise.all([
    systemDb.maybeOne<{ customers: number; orders: number; spend: number }>(
      `select
         (select count(*)::int from users where role = 'customer') as customers,
         (select count(*)::int from orders where customer_id is not null) as orders,
         (select coalesce(sum(total),0)::numeric from orders where payment_status = 'paid') as spend`,
    ),
    systemDb.query<{
      id: string;
      full_name: string;
      email: string;
      phone: string | null;
      status: string;
      role: string;
      orders: number;
      spent: number;
      wallet_balance: number;
      last_order_at: string | null;
      created_at: string;
    }>(
      `select
         u.id,
         u.full_name,
         u.email,
         u.phone,
         u.status,
         u.role,
         coalesce(o.order_count, 0) as orders,
         coalesce(o.total_spent, 0)::numeric as spent,
         coalesce(w.balance, 0)::numeric as wallet_balance,
         o.last_order_at,
         u.created_at
       from users u
       left join (
         select customer_id,
                count(*)::int as order_count,
                coalesce(sum(total),0)::numeric as total_spent,
                max(created_at) as last_order_at
         from orders
         where customer_id is not null
         group by customer_id
       ) o on o.customer_id = u.id
       left join wallets w on w.user_id = u.id
      where u.role = 'customer'
        and (lower(u.full_name) like lower($1) or lower(u.email) like lower($1)
             or lower(u.phone) like lower($1) or $1 = '')
      order by u.created_at desc
      limit 200`,
      [`%${q.trim()}%`],
    ),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customers"
        description={`View registered customers and their order history. ${customers.length} of ${stats?.customers ?? 0} shown.`}
        actions={
          <div className="flex items-end gap-2">
            <form className="flex w-64" action={""}>
              <Field label="Search customers" htmlFor="customer-search" hint="Name, email or phone">
                <input
                  id="customer-search"
                  name="q"
                  defaultValue={q}
                  className="input"
                />
              </Field>
              <SubmitButton className="btn-secondary btn-sm">Search</SubmitButton>
            </form>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registered customers" value={stats?.customers ?? 0} icon={<Users className="size-4" />} />
        <StatCard label="Customers with orders" value={customers.filter((c) => c.orders > 0).length} hint="Of all customers" />
        <StatCard label="Total customer spend" value={formatMoney(Number(stats?.spend ?? 0))} hint="Paid orders" icon={<Wallet className="size-4" />} />
      </div>

      <Card>
        <CardHeader
          title="Customer directory"
          description="Click a customer to view their full profile, orders and wallet activity."
        />
        {customers.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title="No customers found"
            description={q ? "Try a different search term." : "No registered customers yet."}
          />
        ) : (
          <div className="table-wrap overflow-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className="text-left">Contact</th>
                  <th className="text-right">Orders</th>
                  <th className="text-right">Spent</th>
                  <th className="text-right">Wallet</th>
                  <th>Status</th>
                  <th className="text-right">Joined</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link
                        href={`/admin/customers/${c.id}`}
                        className="font-medium text-ink-900 hover:text-brand-700"
                      >
                        {c.full_name}
                      </Link>
                      <p className="text-xs text-ink-500">{c.email}</p>
                    </td>
                    <td className="text-left text-sm">{c.phone ?? "—"}</td>
                    <td className="text-right text-sm">{c.orders}</td>
                    <td className="text-right text-sm">{formatMoney(Number(c.spent))}</td>
                    <td className="text-right text-sm">{formatMoney(Number(c.wallet_balance))}</td>
                    <td>
                      <Badge tone={c.status === "active" ? "success" : "danger"}>
                        {c.status}
                      </Badge>
                    </td>
                    <td className="text-xs text-ink-500 text-right">{formatDate(c.created_at)}</td>
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
