import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { getVendorContext } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { formatMoney, formatDate, timeAgo } from "@/lib/utils";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { QuotationResponseForm } from "@/components/vendor-forms";

export const metadata: Metadata = { title: "Quotations · Vendor dashboard" };

const STATUS_TONES: Record<string, "success" | "warning" | "info" | "danger" | "neutral"> = {
  requested: "warning",
  quoted: "info",
  accepted: "success",
  rejected: "danger",
  expired: "neutral",
  cancelled: "neutral",
};

export default async function VendorQuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { store, category } = await getVendorContext();
  const { status = "open" } = await searchParams;

  const params: unknown[] = [store.id];
  let where = "q.store_id = $1";
  if (status === "open") where += " and q.status in ('requested','quoted')";
  else if (status && status !== "all") {
    params.push(status);
    where += ` and q.status = $${params.length}`;
  }

  const rows = await systemDb.query<{
    id: string;
    title: string | null;
    description: string | null;
    customer_name: string;
    customer_email: string;
    customer_phone: string | null;
    budget: number | null;
    preferred_date: string | null;
    status: string;
    quoted_amount: number | null;
    quote_note: string | null;
    valid_until: string | null;
    created_at: string;
    measurements: Record<string, string> | null;
    reference_images: string[] | null;
    product_name: string | null;
  }>(
    `select q.*, p.name as product_name
       from service_quotations q left join products p on p.id = q.product_id
      where ${where} order by q.created_at desc limit 50`,
    params,
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Quotations"
        description={
          category?.features?.quotations
            ? "Customers request a price for custom work; respond with an amount and terms."
            : "Custom work requests. Quotations are enabled for your category."
        }
      />
      <Tabs
        links={[
          { href: "/vendor/quotations?status=open", label: "Needs attention", active: status === "open" },
          { href: "/vendor/quotations?status=quoted", label: "Quoted", active: status === "quoted" },
          { href: "/vendor/quotations?status=accepted", label: "Accepted", active: status === "accepted" },
          { href: "/vendor/quotations?status=all", label: "All", active: status === "all" },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-5" />}
          title="No quotation requests"
          description="When a customer asks for a custom price, the request will appear here with their brief and measurements."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((quotation) => (
            <Card key={quotation.id}>
              <CardHeader
                title={quotation.title ?? quotation.product_name ?? "Custom request"}
                description={`${quotation.customer_name} · ${timeAgo(quotation.created_at)}${quotation.preferred_date ? ` · needed by ${formatDate(quotation.preferred_date)}` : ""}`}
                action={<Badge tone={STATUS_TONES[quotation.status] ?? "neutral"}>{quotation.status}</Badge>}
              />
              <div className="card-pad grid gap-4 lg:grid-cols-2">
                <div className="space-y-3 text-sm">
                  <p className="whitespace-pre-line text-ink-700">{quotation.description}</p>
                  <dl className="grid gap-1.5 text-sm">
                    <div className="flex justify-between gap-4"><dt className="text-ink-500">Email</dt><dd className="break-all text-right text-ink-800">{quotation.customer_email}</dd></div>
                    {quotation.customer_phone ? <div className="flex justify-between gap-4"><dt className="text-ink-500">Phone</dt><dd className="text-ink-800">{quotation.customer_phone}</dd></div> : null}
                    {quotation.budget ? <div className="flex justify-between gap-4"><dt className="text-ink-500">Customer budget</dt><dd className="font-semibold text-ink-900">{formatMoney(Number(quotation.budget))}</dd></div> : null}
                    {quotation.product_name ? <div className="flex justify-between gap-4"><dt className="text-ink-500">Product</dt><dd className="text-ink-800">{quotation.product_name}</dd></div> : null}
                  </dl>
                  {quotation.measurements && Object.keys(quotation.measurements).length > 0 ? (
                    <div className="rounded-lg bg-ink-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Measurements</p>
                      <div className="mt-1 grid grid-cols-2 gap-1 text-xs text-ink-700">
                        {Object.entries(quotation.measurements).map(([key, value]) => (
                          <p key={key}><span className="text-ink-400">{key}:</span> {value}</p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {quotation.reference_images && quotation.reference_images.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {quotation.reference_images.map((image) => (
                        <a key={image} href={image} target="_blank" rel="noreferrer" className="block size-16 overflow-hidden rounded-lg border border-ink-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={image} alt="" className="size-16 object-cover" />
                        </a>
                      ))}
                    </div>
                  ) : null}
                  {quotation.quoted_amount ? (
                    <div className="rounded-lg border border-brand-100 bg-brand-50 p-3 text-sm text-brand-900">
                      <p className="font-semibold">Quoted {formatMoney(Number(quotation.quoted_amount))}</p>
                      {quotation.quote_note ? <p className="mt-1 text-brand-800">{quotation.quote_note}</p> : null}
                      {quotation.valid_until ? <p className="mt-1 text-xs text-brand-700">Valid until {formatDate(quotation.valid_until)}</p> : null}
                    </div>
                  ) : null}
                </div>
                <div>
                  {["requested", "quoted"].includes(quotation.status) ? (
                    <div className="rounded-xl border border-ink-100 p-3">
                      <p className="mb-2 text-sm font-semibold text-ink-900">
                        {quotation.status === "requested" ? "Send a quotation" : "Revise quotation"}
                      </p>
                      <QuotationResponseForm
                        quotationId={quotation.id}
                        suggestedAmount={quotation.quoted_amount ? String(Number(quotation.quoted_amount)) : quotation.budget ? String(Number(quotation.budget)) : ""}
                      />
                    </div>
                  ) : (
                    <p className="rounded-xl bg-ink-50 p-3 text-sm text-ink-500">
                      This quotation is {quotation.status}. {quotation.status === "accepted" ? "The customer accepted your price — convert it into an order from their order history." : ""}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-ink-400">
                    Customers are notified by email and can accept your quote from their <Link href="/account/quotations" className="underline">account</Link>.
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
