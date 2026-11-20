import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { ReviewForm } from "@/components/review-form";

export const metadata: Metadata = { title: "My reviews · Ibom Vendors Hub" };

export default async function AccountReviewsPage() {
  const user = await requireUser(["customer", "vendor", "admin", "super_admin"]);
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
    }>(
      `select r.id, r.rating, r.title, r.comment, r.status, r.vendor_response, r.created_at,
              s.name as store_name, s.slug as store_slug, p.name as product_name
         from reviews r join stores s on s.id = r.store_id left join products p on p.id = r.product_id
        where r.customer_id = $1 or lower(r.customer_email) = lower($2)
        order by r.created_at desc`,
      [user.id, user.email],
    ),
    systemDb.query<{
      order_id: string;
      order_reference: string;
      product_id: string;
      product_name: string;
      product_slug: string;
      store_name: string;
      store_slug: string;
    }>(
      `select distinct on (o.id, oi.product_id) o.id as order_id, o.reference as order_reference,
              oi.product_id, oi.name as product_name,
              p.slug as product_slug, s.name as store_name, s.slug as store_slug
         from orders o
         join order_items oi on oi.order_id = o.id
         join products p on p.id = oi.product_id
         join stores s on s.id = o.store_id
        where (o.customer_id = $1 or lower(o.customer_email) = lower($2))
          and o.status in ('delivered','completed')
          and not exists (
            select 1 from reviews r where r.order_id = o.id and r.product_id = oi.product_id
          )
        limit 8`,
      [user.id, user.email],
    ),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader title="My reviews" description="Only logged-in customers with verified completed purchases can publish reviews." />

      {pending.length > 0 ? (
        <Card className="card-pad space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">Ready to review ({pending.length})</h2>
            <p className="text-xs text-ink-500">Completed orders waiting for your honest feedback.</p>
          </div>
          <div className="space-y-4">
            {pending.map((item) => (
              <div key={`${item.order_id}-${item.product_id}`} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
                  <span>
                    From <Link href={`/s/${item.store_slug}/products/${item.product_slug}#review`} className="font-semibold text-brand-800 hover:underline">{item.store_name}</Link> · Order {item.order_reference}
                  </span>
                  <Link href={`/account/orders/${item.order_id}#reviews`} className="font-medium text-ink-600 hover:underline">
                    View order →
                  </Link>
                </div>
                <ReviewForm
                  orderId={item.order_id}
                  productId={item.product_id}
                  itemLabel={item.product_name}
                  compact
                />
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {reviews.length === 0 ? (
        <Card className="card-pad">
          <EmptyState
            icon={<Star className="size-5" />}
            title="No reviews written yet"
            description="Reviews become available once your order has been delivered and confirmed."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <Card key={review.id} className="card-pad space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink-900">{review.product_name ?? review.store_name}</p>
                  <p className="text-xs text-ink-400">{review.store_name} · {formatDate(review.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-600">
                    <Star className="size-4 fill-amber-400 text-amber-400" /> {review.rating}
                  </span>
                  <Badge tone={review.status === "published" ? "success" : "warning"}>{review.status}</Badge>
                </div>
              </div>
              {review.title ? <p className="text-sm font-semibold text-ink-800">{review.title}</p> : null}
              {review.comment ? <p className="text-sm text-ink-700">{review.comment}</p> : null}
              {review.vendor_response ? (
                <div className="rounded-xl bg-ink-50 p-3 text-sm">
                  <p className="text-xs font-semibold text-ink-500">Vendor response</p>
                  <p className="text-ink-700">{review.vendor_response}</p>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
