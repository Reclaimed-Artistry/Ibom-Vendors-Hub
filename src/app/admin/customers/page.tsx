import type { Metadata } from "next";
import Link from "next/link";
import { Users, Search, Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { formatMoney, formatDate } from "@/lib/utils";
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { customerSearchPattern } from "@/lib/customer-search";

export const metadata: Metadata = { title: "Customers · Admin" };

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 200) : "";

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
      [customerSearchPattern(q)],
    ),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customers"
        description={`View registered customers and their order history. ${customers.length} of ${stats?.customers ?? 0} shown.`}
        actions={
          <form method="get" action="/admin/customers" role="search" className="w-full sm:w-auto">
            <label htmlFor="customer-search" className="mb-1.5 block text-xs font-semibold text-ink-700">Search customers</label>
            <div className="flex w-full items-center gap-2 sm:w-[360px]">
              <input
                key={q}
                id="customer-search"
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Name, email or phone"
                maxLength={200}
                className="input min-w-0 flex-1"
              />
              <button type="submit" className="btn-secondary shrink-0 gap-1.5">
                <Search className="size-4" aria-hidden="true" />Search
              </button>
            </div>
            {q ? <Link href="/admin/customers" className="mt-1.5 inline-block text-xs font-semibold text-brand-700 hover:underline">Clear search</Link> : null}
          </form>
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
          description={q ? `Search results for “${q}”. Click a customer to view their profile.` : "Click a customer to view their full profile, orders and wallet activity."}
        />
        {customers.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title="No customers found"
            description={q ? "Try a different name, email address or phone number." : "No registered customers yet."}
            action={q ? <Link href="/admin/customers" className="btn-secondary">Show all customers</Link> : undefined}
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
