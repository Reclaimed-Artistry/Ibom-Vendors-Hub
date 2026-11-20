import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { formatMoney, formatDate, timeAgo } from "@/lib/utils";
import { Badge, ButtonLink, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { acceptQuotationAction, declineQuotationAction } from "@/app/actions/account";

export const metadata: Metadata = { title: "My quotations · Ibom Vendors Hub" };

export default async function AccountQuotationsPage() {
  const user = await requireUser(["customer", "vendor", "admin", "super_admin"]);
  const rows = await systemDb.query<{
    id: string;
    title: string | null;
    description: string | null;
    status: string;
    quoted_amount: number | null;
    quote_note: string | null;
    valid_until: string | null;
    created_at: string;
    store_name: string;
    store_slug: string;
    product_name: string | null;
  }>(
    `select q.id, q.title, q.description, q.status, q.quoted_amount, q.quote_note, q.valid_until, q.created_at,
            s.name as store_name, s.slug as store_slug, p.name as product_name
       from service_quotations q
       join stores s on s.id = q.store_id
       left join products p on p.id = q.product_id
      where lower(q.customer_email) = lower($1)
      order by q.created_at desc limit 50`,
    [user.email],
  );

  return (
    <div className="space-y-4">
      <PageHeader title="My quotations" description="Custom work requests you sent to vendors and their replies." actions={<ButtonLink href="/browse" variant="secondary" size="sm">Request another quote</ButtonLink>} />
      {rows.length === 0 ? (
        <EmptyState icon={<FileText className="size-5" />} title="No quotations yet" description="Ask a vendor for a custom price from any product or service page." />
      ) : (
        <div className="space-y-3">
          {rows.map((quotation) => {
            const expired = quotation.valid_until ? new Date(quotation.valid_until).getTime() < Date.now() : false;
            return (
              <Card key={quotation.id}>
                <CardHeader
                  title={quotation.title ?? quotation.product_name ?? "Custom request"}
                  description={`${quotation.store_name} · sent ${timeAgo(quotation.created_at)}`}
                  action={<Badge tone={quotation.status === "accepted" ? "success" : quotation.status === "quoted" ? "info" : quotation.status === "rejected" ? "danger" : "warning"}>{quotation.status}</Badge>}
                />
                <div className="card-pad space-y-3 text-sm">
                  {quotation.description ? <p className="whitespace-pre-line text-ink-600">{quotation.description}</p> : null}
                  {quotation.quoted_amount ? (
                    <div className="rounded-xl border border-brand-100 bg-brand-50 p-3">
                      <p className="font-semibold text-brand-900">Quote: {formatMoney(Number(quotation.quoted_amount))}</p>
                      {quotation.quote_note ? <p className="mt-1 text-brand-800">{quotation.quote_note}</p> : null}
                      <p className="mt-1 text-xs text-brand-700">
                        {quotation.valid_until ? `Valid until ${formatDate(quotation.valid_until)}${expired ? " (expired)" : ""}` : "No expiry given"}
                      </p>
                    </div>
                  ) : (
                    <p className="text-ink-500">The vendor has not sent a price yet.</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/s/${quotation.store_slug}`} className="btn btn-ghost btn-sm">Visit store</Link>
                    {quotation.status === "quoted" && !expired ? (
                      <>
                        <form action={acceptQuotationAction}>
                          <input type="hidden" name="quotationId" value={quotation.id} />
                          <button type="submit" className="btn btn-primary btn-sm">Accept quote</button>
                        </form>
                        <form action={declineQuotationAction}>
                          <input type="hidden" name="quotationId" value={quotation.id} />
                          <button type="submit" className="btn btn-ghost btn-sm">Decline</button>
                        </form>
                      </>
                    ) : null}
                    {quotation.status === "accepted" ? (
                      <p className="text-xs text-ink-500">Accepted — the vendor will confirm production and payment details with you.</p>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
