import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "My reviews · Ibom Vendors Hub" };

export default async function AccountReviewsPage() {
  const user = await requireUser(["customer"]);
  const [reviews, pending] = await Promise.all([
    systemDb.query<{
      id: string;
      rating: number;
      title: string | null;
      comment: string | null;
      status: string;
      vendor_response: string | null;
      created_at: string;
      store_name: string;
      store_slug: string;
      product_name: string | null;
      product_slug: string | null;
    }>(
      `select r.id, r.rating, r.title, r.comment, r.status, r.vendor_response, r.created_at,
              s.name as store_name, s.slug as store_slug,
              p.name as product_name, p.slug as product_slug
         from reviews r join stores s on s.id = r.store_id left join products p on p.id = r.product_id
        where lower(r.customer_email) = lower($1)
        order by r.created_at desc limit 50`,
      [user.email],
    ),
    systemDb.query<{ order_id: string; reference: string; store_name: string; store_slug: string; product_name: string; product_slug: string; product_id: string }>(
      `select o.id as order_id, o.reference, s.name as store_name, s.slug as store_slug,
              p.name as product_name, p.slug as product_slug, p.id as product_id
         from orders o
         join stores s on s.id = o.store_id
         join order_items i on i.order_id = o.id
         join products p on p.id = i.product_id
        where lower(o.customer_email) = lower($1) and o.status in ('delivered','completed')
          and not exists (
            select 1 from reviews r where r.order_id = o.id and r.product_id = p.id
          )
        group by o.id, o.reference, s.name, s.slug, p.name, p.slug, p.id
        limit 6`,
      [user.email],
    ),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader title="My reviews" description="Feedback you left for vendors, and their replies." />

      {pending.length > 0 ? (
        <Card>
          <CardHeader title="Waiting for your review" description="Tell other customers how it went." />
          <ul className="divide-y divide-ink-100">
            {pending.map((item) => (
              <li key={`${item.order_id}-${item.product_id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div>
                  <p className="font-medium text-ink-900">{item.product_name}</p>
                  <p className="text-xs text-ink-500">{item.store_name} · {item.reference}</p>
                </div>
                <Link href={`/s/${item.store_slug}/products/${item.product_slug}#review`} className="btn btn-secondary btn-sm">Write a review</Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {reviews.length === 0 ? (
        <EmptyState icon={<Star className="size-5" />} title="No reviews yet" description="After a completed order you can review the product from its page." />
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardHeader
                title={review.title ?? review.product_name ?? "Review"}
                description={`${review.store_name} · ${formatDate(review.created_at)}`}
                action={
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-0.5 text-amber-500">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star key={index} className={`size-3.5 ${index < review.rating ? "fill-current" : "text-ink-200"}`} />
                      ))}
                    </span>
                    {review.status !== "published" ? <Badge tone="warning">{review.status}</Badge> : null}
                  </div>
                }
              />
              <div className="card-pad space-y-3">
                {review.comment ? <p className="whitespace-pre-line text-sm text-ink-700">{review.comment}</p> : null}
                {review.vendor_response ? (
                  <div className="rounded-xl border-l-4 border-brand-500 bg-brand-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Vendor reply</p>
                    <p className="mt-1 text-sm text-brand-900">{review.vendor_response}</p>
                  </div>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
