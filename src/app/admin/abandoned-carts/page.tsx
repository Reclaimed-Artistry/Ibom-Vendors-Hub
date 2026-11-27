import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { PageHeader, StatusBadge } from "@/components/ui";
import { Truck, AlertTriangle } from "lucide-react";

export const metadata: Metadata = { title: "Abandoned carts · Admin" };

export default async function AbandonedCartsPage() {
  await requireAdmin();

  const rows = await systemDb.query<{
    id: string;
    customer_email: string;
    customer_name: string;
    items_json: any;
    subtotal: number;
    currency: string;
    checkout_reference: string | null;
    recovered_at: string | null;
    recovery_sent: boolean;
    created_at: string;
  }>(
    `select id, customer_email, customer_name, items_json, subtotal, currency,
            checkout_reference, recovered_at, recovery_sent, created_at
       from abandoned_carts
      order by created_at desc limit 100`,
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Abandoned cart recovery"
        description="Carts that were started but not completed. Send recovery emails to win back the sale."
        actions={null}
      />

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-200 bg-white p-12 text-center">
          <AlertTriangle className="mx-auto mb-3 size-8 text-ink-200" />
          <h3 className="text-base font-semibold text-ink-900">No abandoned carts</h3>
          <p className="mt-1 text-sm text-ink-500">
            Every shopper who started a cart completed their purchase — or hasn&rsquo;t left one behind yet.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-ink-100 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-ink-100">
                  <th className="pb-3 px-4 text-left text-xs font-semibold text-ink-400">Customer</th>
                  <th className="pb-3 px-4 text-left text-xs font-semibold text-ink-400">Items</th>
                  <th className="pb-3 px-4 text-right text-xs font-semibold text-ink-400">Cart value</th>
                  <th className="pb-3 px-4 text-left text-xs font-semibold text-ink-400">Left at</th>
                  <th className="pb-3 px-4 text-left text-xs font-semibold text-ink-400">Recovery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((cart) => {
                  const items = Array.isArray(cart.items_json) ? cart.items_json : [];
                  const itemNames = items.map((i: any) => i.name).join(", ");
                  const itemCount = items.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0);
                  const recovered = Boolean(cart.recovered_at);
                  const sent = Boolean(cart.recovery_sent);

                  return (
                    <tr key={cart.id} className="hover:bg-ink-50/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink-900">{cart.customer_name}</p>
                        <p className="text-xs text-ink-500">{cart.customer_email}</p>
                      </td>
                      <td className="px-4 py-3 text-ink-700">
                        <p>{itemCount} item{itemCount !== 1 ? "s" : ""}</p>
                        {itemNames ? <p className="mt-0.5 text-[11px] text-ink-400 truncate max-w-[200px]">{itemNames}</p> : null}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-ink-900">
                        {formatMoney(Number(cart.subtotal), cart.currency, "₦")}
                      </td>
                      <td className="px-4 py-3 text-ink-600">
                        <time>{new Date(cart.created_at).toLocaleDateString("en-NG", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}</time>
                      </td>
                      <td className="px-4 py-3">
                        {recovered ? (
                          <StatusBadge status="resolved" />
                        ) : sent ? (
                          <StatusBadge status="warning" />
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-ink-500">
                            <Truck className="size-3.5" /> Pending
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-ink-100 bg-white p-4 text-sm text-ink-600">
        <p className="font-semibold text-ink-900">How recovery works</p>
        <ul className="mt-2 space-y-1 list-disc list-inside text-[12px]">
          <li>Carts are recorded when a signed-in customer reaches checkout but does not complete payment.</li>
          <li>Recovery emails are sent through your configured Whogohost SMTP (Admin → Emails).</li>
          <li>Mark a cart as recovered when the customer returns and completes the purchase.</li>
          <li>Recovery requires SMTP credentials — without them, emails are logged but not delivered.</li>
        </ul>
      </div>
    </div>
  );
}
