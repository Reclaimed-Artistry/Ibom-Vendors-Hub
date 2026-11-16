import type { Metadata } from "next";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { requireActiveVendorContext } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { formatMoney, formatDate } from "@/lib/utils";
import { Avatar, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Customers · Vendor dashboard" };

export default async function VendorCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { store } = await requireActiveVendorContext();
  const { q } = await searchParams;

  const params: unknown[] = [store.id];
  let filter = "";
  if (q) {
    params.push(`%${q}%`);
    filter = ` and (o.customer_name ilike $${params.length} or o.customer_email ilike $${params.length} or o.customer_phone ilike $${params.length})`;
  }

  const customers = await systemDb.query<{
    email: string;
    name: string;
    phone: string;
    orders: number;
    paid_orders: number;
    spend: number;
    last_order: string;
  }>(
    `select lower(o.customer_email) as email,
            (array_agg(o.customer_name order by o.created_at desc))[1] as name,
            (array_agg(o.customer_phone order by o.created_at desc))[1] as phone,
            count(*)::int as orders,
            count(*) filter (where o.payment_status = 'paid')::int as paid_orders,
            coalesce(sum(o.total) filter (where o.payment_status = 'paid'), 0)::numeric as spend,
            max(o.created_at) as last_order
       from orders o
      where o.store_id = $1${filter}
      group by lower(o.customer_email)
      order by max(o.created_at) desc
      limit 100`,
    params,
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customers"
        description="Everyone who has ordered from your storefront, with lifetime value at a glance."
      />

      <form className="card card-pad flex flex-wrap items-end gap-3" action="/vendor/customers">
        <label className="min-w-56 flex-1">
          <span className="label">Search customers</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <input name="q" defaultValue={q ?? ""} className="input pl-9" placeholder="Name, email or phone" />
          </span>
        </label>
        <button className="btn btn-secondary" type="submit">Search</button>
        {q ? <Link href="/vendor/customers" className="btn btn-ghost btn-sm">Clear</Link> : null}
      </form>

      {customers.length === 0 ? (
        <EmptyState
          icon={<Users className="size-5" />}
          title={q ? "No customers match" : "No customers yet"}
          description={q ? "Try another name, email or phone number." : "Customers appear here after their first order."}
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Contact</th>
                <th className="text-center">Orders</th>
                <th className="text-right">Lifetime spend</th>
                <th>Last order</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.email}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar name={customer.name} size={32} />
                      <span className="font-medium text-ink-900">{customer.name}</span>
                    </div>
                  </td>
                  <td>
                    <p className="text-sm break-all text-ink-700">{customer.email}</p>
                    <p className="text-xs text-ink-400">{customer.phone}</p>
                  </td>
                  <td className="text-center text-sm">
                    {customer.orders}
                    {customer.paid_orders !== customer.orders ? (
                      <span className="block text-[11px] text-ink-400">{customer.paid_orders} paid</span>
                    ) : null}
                  </td>
                  <td className="text-right font-semibold">{formatMoney(Number(customer.spend))}</td>
                  <td className="text-sm text-ink-500">{formatDate(customer.last_order)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
