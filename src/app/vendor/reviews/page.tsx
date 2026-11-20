import type { Metadata } from "next";
import { Star } from "lucide-react";
import { requireActiveVendorContext } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { formatDate, timeAgo } from "@/lib/utils";
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { ReviewResponseForm } from "@/components/vendor-forms";

export const metadata: Metadata = { title: "Reviews · Vendor dashboard" };

export default async function VendorReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { store } = await requireActiveVendorContext();
  const { filter = "all" } = await searchParams;

  const [summary, rows] = await Promise.all([
    systemDb.one<{ average: number; total: number; unanswered: number }>(
      `select coalesce(avg(rating),0)::numeric as average, count(*)::int as total,
              count(*) filter (where vendor_response is null)::int as unanswered
         from reviews where store_id = $1 and status = 'published'`,
      [store.id],
    ),
    systemDb.query<{
      id: string;
      rating: number;
      title: string | null;
      body: string;
      vendor_response: string | null;
      vendor_responded_at: string | null;
      status: string;
      created_at: string;
      customer_name: string;
      product_name: string | null;
    }>(
      `select r.id, r.rating, r.title, r.comment as body, r.vendor_response, r.vendor_responded_at, r.status, r.created_at,
              coalesce(r.customer_name, u.full_name, 'Customer') as customer_name, p.name as product_name
         from reviews r
         left join users u on u.id = r.customer_id
         left join products p on p.id = r.product_id
        where r.store_id = $1 ${filter === "unanswered" ? "and r.vendor_response is null" : ""}
        order by r.created_at desc limit 50`,
      [store.id],
    ),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader title="Reviews" description="Replying publicly builds trust and shows customers you listen." />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Average rating" value={Number(summary.average).toFixed(1)} hint={`${summary.total} published`} icon={<Star className="size-4" />} />
        <StatCard label="Unanswered" value={summary.unanswered} hint="Add a vendor reply" />
        <StatCard label="5-star reviews" value={rows.filter((row) => row.rating === 5).length} hint="In the latest page" />
      </div>

      <div className="flex gap-2">
        <a href="/vendor/reviews" className={`btn btn-sm ${filter === "all" ? "btn-primary" : "btn-secondary"}`}>All reviews</a>
        <a href="/vendor/reviews?filter=unanswered" className={`btn btn-sm ${filter === "unanswered" ? "btn-primary" : "btn-secondary"}`}>Needs reply</a>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<Star className="size-5" />} title="No reviews yet" description="Reviews from verified customers will appear here." />
      ) : (
        <div className="space-y-3">
          {rows.map((review) => (
            <Card key={review.id}>
              <CardHeader
                title={review.title ?? "Customer review"}
                description={`${review.customer_name} · ${review.product_name ?? "Store"} · ${timeAgo(review.created_at)}`}
                action={
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-0.5 text-amber-500">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star key={index} className={`size-3.5 ${index < review.rating ? "fill-current" : "text-ink-200"}`} />
                      ))}
                    </span>
                    {review.status !== "published" ? <Badge tone="warning">Hidden</Badge> : null}
                    {review.vendor_response ? <Badge tone="success">Replied</Badge> : <Badge tone="neutral">No reply</Badge>}
                  </div>
                }
              />
              <div className="card-pad">
                <p className="whitespace-pre-line text-sm text-ink-700">{review.body}</p>
                {review.vendor_response ? (
                  <div className="mt-3 rounded-xl border-l-4 border-brand-500 bg-brand-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                      Your reply {review.vendor_responded_at ? `· ${formatDate(review.vendor_responded_at)}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-brand-900">{review.vendor_response}</p>
                  </div>
                ) : (
                  <ReviewResponseForm reviewId={review.id} />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
