import { ProductMediaGallery } from "@/components/product-media-gallery";
import { firstListingImage } from "@/lib/product-media";
import { listingCategory } from "@/lib/category-policy";
import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { NO_INDEX, publicMetadata, seoDescription, storeUrl } from "@/lib/seo";
import { breadcrumbStructuredData, productStructuredData } from "@/lib/structured-data";
import { isPropertyCategory } from "@/lib/property-inspections";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ClipboardCheck, Clock, Package, ShieldCheck, Star } from "lucide-react";
import { getStoreProduct, getStoreReviews, resolveStore } from "@/lib/storefront";
import { getSettings } from "@/lib/settings";
import { storeBase } from "@/lib/storefront-base";
import { formatMoney, formatDate } from "@/lib/utils";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { AddToCart } from "@/components/add-to-cart";
import { ReviewForm } from "@/components/review-form";
import { AdUnit } from "@/components/ad-unit";
import { getCurrentUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { getCategoryBookingProfile } from "@/lib/artisan-bookings";
import { trackProductView } from "@/lib/visitor-tracking";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ slug: string; productSlug: string }> }): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const { store, live } = await resolveStore(slug);
  if (!store) return { title: "Store not found", robots: NO_INDEX };
  const product = await getStoreProduct(store.id, productSlug);
  if (!product) return { title: "Listing not found", robots: NO_INDEX };
  return publicMetadata({
    title: `${product.name} | ${store.name} · Ibom Vendors Hub`,
    description: seoDescription(product.short_description || product.description, `${product.name} from ${store.name} in ${store.city || "Akwa Ibom"}. View details and contact this vendor on Ibom Vendors Hub.`),
    url: storeUrl(store.slug, `/products/${encodeURIComponent(product.slug)}`),
    image: firstListingImage(product.images) || store.cover_url || store.logo_url,
    index: live,
  });
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string; productSlug: string }> }) {
  const { slug, productSlug } = await params;
  const { store, category: primaryCategory, live } = await resolveStore(slug);
  if (!store) notFound();
  const product = await getStoreProduct(store.id, productSlug);
  if (!product) notFound();
  await trackProductView(product.id);
  const category = listingCategory(product, primaryCategory);

  const [settings, base, reviews, user] = await Promise.all([
    getSettings(),
    storeBase(slug),
    getStoreReviews(store.id, 8, product.id),
    getCurrentUser(),
  ]);

  let eligibleOrderId: string | null = null;
  let alreadyReviewedByUser = false;
  if (user) {
    const [unreviewedOrder, existingReview] = await Promise.all([
      systemDb.maybeOne<{ id: string }>(
        `select o.id
           from orders o
           join order_items oi on oi.order_id = o.id
          where o.store_id = $1
            and oi.product_id = $2
            and (o.customer_id = $3 or lower(o.customer_email) = lower($4))
            and o.status in ('delivered', 'completed')
            and not exists (
              select 1 from reviews r where r.order_id = o.id and r.product_id = $2
            )
          order by o.created_at desc
          limit 1`,
        [store.id, product.id, user.id, user.email],
      ),
      systemDb.maybeOne<{ id: string }>(
        `select id from reviews
          where product_id = $1
            and (customer_id = $2 or lower(customer_email) = lower($3))
          limit 1`,
        [product.id, user.id, user.email],
      ),
    ]);
    eligibleOrderId = unreviewedOrder?.id ?? null;
    alreadyReviewedByUser = Boolean(existingReview);
  }
  const propertyListing = isPropertyCategory(category?.slug);
  const features = (category?.features ?? {}) as Record<string, boolean>;
  const money = (value: number) => formatMoney(value, product.currency, settings.currency_symbol);

  return (
    <div className="container-page py-8">
      {live ? <JsonLd data={productStructuredData(product, store, category)} /> : null}
      <JsonLd data={breadcrumbStructuredData([
        { name: store.name, url: storeUrl(store.slug) },
        { name: "Catalogue", url: storeUrl(store.slug, "/products") },
        { name: product.name, url: storeUrl(store.slug, `/products/${encodeURIComponent(product.slug)}`) },
      ])} />
      <nav className="mb-5 flex items-center gap-1.5 text-xs text-ink-400">
        <Link href={base || "/"} className="break-words hover:text-ink-700">{store.name}</Link>
        <span>/</span>
        <Link href={`${base}/products`} className="hover:text-ink-700">{features.serviceBooking ? "Services" : "Catalogue"}</Link>
        <span>/</span>
        <span className="text-ink-600">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <ProductMediaGallery items={product.images ?? []} name={product.name} />

        <div>
          <div className="flex flex-wrap items-center gap-2">
            {product.kind === "service" ? <Badge tone="info">Service</Badge> : null}
            {product.made_to_order ? <Badge tone="warning">Made to order</Badge> : null}
            {product.condition ? <Badge tone="neutral">{product.condition}</Badge> : null}
            {product.track_stock && product.stock_quantity > 0 ? <Badge tone="success">{product.stock_quantity} in stock</Badge> : null}
            {product.track_stock && product.stock_quantity <= 0 ? <Badge tone="danger">Out of stock</Badge> : null}
          </div>
          <h1 className="mt-3 font-display text-3xl text-ink-900">{product.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-ink-500">
            {product.rating_count > 0 ? (
              <span className="inline-flex items-center gap-1 font-semibold text-gold-600">
                <Star className="size-4 fill-current" /> {product.rating_avg} ({product.rating_count})
              </span>
            ) : (
              <span>No reviews yet</span>
            )}
            {product.brand ? <span>Brand: {product.brand}</span> : null}
            {product.sku ? <span>SKU: {product.sku}</span> : null}
          </div>

          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-ink-900">
              {product.pricing_type === "quotation" ? "Price on request" : money(product.price)}
            </span>
            {product.compare_at_price ? <span className="text-sm text-ink-400 line-through">{money(product.compare_at_price)}</span> : null}
            {product.pricing_type === "from" ? <span className="text-xs text-ink-400">starting price</span> : null}
          </div>

          {propertyListing ? <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-4 space-y-2 text-sm">
            <p className="font-bold">{product.attributes?.listing_type} · {product.attributes?.property_type}</p>
            <p>Property location: {product.attributes?.property_location}</p>
            <p>Property price basis: {product.attributes?.price_period}</p>
            <p>Inspection fee: <strong>{Number(product.attributes?.inspection_fee) === 0 ? "Free" : money(Number(product.attributes?.inspection_fee ?? 0))}</strong> — separate from the property price; payable directly to agent by arrangement.</p>
            {product.attributes?.additional_fees ? <p>Other fees / terms: {product.attributes.additional_fees}</p> : null}
            <p className="text-xs">Book an available inspection time and review its exact meeting point. Verify the property and agent’s authority before paying rent or a purchase deposit.</p>
          </div> : null}

          {product.short_description ? <p className="mt-4 text-sm leading-7 text-ink-600">{product.short_description}</p> : null}

          <div className="mt-5 space-y-3">
            {product.made_to_order ? (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
                <Clock className="mt-0.5 size-4 shrink-0" />
                <p>
                  This item is made to order{product.production_days ? ` and takes about ${product.production_days} days to produce` : ""}. Add your
                  measurements or instructions below; the vendor confirms the timeline when accepting.
                </p>
              </div>
            ) : null}
            {product.service_duration_minutes ? (
              <p className="flex items-center gap-2 text-sm text-ink-500"><Clock className="size-4" /> Appointment length: {product.service_duration_minutes} minutes</p>
            ) : null}
            {product.warranty_info ? (
              <p className="flex items-center gap-2 text-sm text-ink-500"><ShieldCheck className="size-4" /> {product.warranty_info}</p>
            ) : null}
            {product.prep_time_minutes ? (
              <p className="flex items-center gap-2 text-sm text-ink-500"><Clock className="size-4" /> Preparation time: about {product.prep_time_minutes} minutes</p>
            ) : null}
            {product.portion ? <p className="flex items-center gap-2 text-sm text-ink-500"><Package className="size-4" /> Portion: {product.portion}</p> : null}

          </div>

          <div className="mt-6">
            {(() => {
              const bookingProfile = getCategoryBookingProfile(category?.slug);
              const showBooking = !features.inquiryOnly && (product.kind === "service" || Boolean(features.serviceBooking));
              const showCart = !features.inquiryOnly && !propertyListing && product.kind !== "service" && features.cart !== false;
              const showQuote = Boolean(features.quotations) && product.pricing_type !== "quotation";

              if (!live) {
                return (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    This storefront is offline, so new orders and bookings are disabled. Please check back later.
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {showBooking && !propertyListing ? (
                    <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-4">
                      <div className="flex items-start gap-2.5">
                        <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-brand-700" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold uppercase tracking-wider text-brand-900">
                            {bookingProfile.requirementsTitle}
                          </p>
                          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-ink-800">
                            {bookingProfile.requirements.map((req, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-brand-700" />
                                <span>{req}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {features.inquiryOnly ? <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">Send your requirements and preferred dates. The vendor must confirm availability, final cost and terms. This is not an instant confirmed reservation.</p> : null}
                  {showCart ? (
                    <AddToCart product={product} store={store} currencySymbol={settings.currency_symbol} />
                  ) : product.pricing_type === "quotation" ? (
                    <ButtonLink href={`${base}/quote/${product.slug}`} className="w-full">
                      Request a quotation
                    </ButtonLink>
                  ) : null}

                  {showBooking ? (
                    <ButtonLink
                      href={`${base}/book/${product.slug}`}
                      variant={showCart || product.pricing_type === "quotation" ? "secondary" : "primary"}
                      className="w-full"
                    >
                      {propertyListing ? "Book inspection" : product.kind === "service" ? "Book now" : bookingProfile.ctaLabel}
                    </ButtonLink>
                  ) : null}

                  {showQuote && !showCart ? (
                    <ButtonLink href={`${base}/quote/${product.slug}`} variant="secondary" className="w-full">
                      Request a quotation
                    </ButtonLink>
                  ) : null}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-6">
          <Card className="card-pad">
            <h2 className="text-base font-semibold text-ink-900">Description</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-7 text-ink-600">{product.description}</p>

            {Object.keys(product.specifications ?? {}).length ? (
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-ink-900">Specifications</h3>
                <dl className="mt-2 divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-100">
                  {Object.entries(product.specifications).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-2 gap-3 px-3 py-2 text-sm">
                      <dt className="text-ink-500">{key}</dt>
                      <dd className="font-medium text-ink-800">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}

            {Object.keys(product.attributes ?? {}).length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {Object.entries(product.attributes).map(([key, value]) => (
                  <span key={key} className="badge-neutral">{category?.attributes?.find(field => field.key === key)?.label ?? key.replaceAll("_", " ")}: {value}</span>
                ))}
              </div>
            ) : null}

            {product.size_guide?.length ? (
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-ink-900">Size guide</h3>
                <ul className="mt-2 space-y-1 text-sm text-ink-600">
                  {product.size_guide.map((row, index) => (
                    <li key={index}>{row.label}: {row.value}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          <div className="mt-4 mb-4">
            <AdUnit adSlot="product-page-banner" style={{ minHeight: "280px" }} />
          </div>

          <Card id="review" className="card-pad space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-ink-900">Verified customer reviews</h2>
              <span className="text-xs text-ink-400">Logged-in buyers only</span>
            </div>

            {user ? (
              eligibleOrderId ? (
                <ReviewForm
                  orderId={eligibleOrderId}
                  productId={product.id}
                  itemLabel={product.name}
                />
              ) : alreadyReviewedByUser ? (
                <p className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50/60 px-3.5 py-2.5 text-xs font-medium text-brand-900">
                  <CheckCircle2 className="size-4 text-brand-700" /> You have already reviewed this verified purchase.
                </p>
              ) : (
                <p className="rounded-xl border border-ink-100 bg-ink-50/70 px-3.5 py-2.5 text-xs text-ink-600">
                  Reviews unlock automatically once you purchase and confirm delivery of this item.
                </p>
              )
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-100 bg-ink-50/70 px-3.5 py-2.5 text-xs text-ink-600">
                <span>Sign in to leave a review — only signed-in customers with a completed purchase can review.</span>
                <Link
                  href={`/login?next=${encodeURIComponent(`/s/${slug}/products/${productSlug}#review`)}`}
                  className="font-semibold text-brand-800 hover:underline"
                >
                  Sign in →
                </Link>
              </div>
            )}

            {reviews.length === 0 ? (
              <p className="text-sm text-ink-500">No reviews yet. Be the first verified buyer to share feedback.</p>
            ) : (
              <ul className="space-y-4">
                {reviews.map((review) => (
                  <li key={review.id} className="border-b border-ink-100 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-ink-900">{review.customer_name}</p>
                        {review.verified_purchase ? (
                          <Badge tone="success">Verified purchase</Badge>
                        ) : null}
                      </div>
                      <span className="text-xs text-gold-600">{"★".repeat(review.rating)}</span>
                    </div>
                    {review.title ? <p className="mt-0.5 text-sm font-medium text-ink-800">{review.title}</p> : null}
                    <p className="mt-1 text-sm leading-6 text-ink-600">{review.comment}</p>
                    <p className="mt-1 text-[11px] text-ink-400">{formatDate(review.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="card-pad">
            <div className="flex items-center gap-3">
              <img src={store.logo_url ?? ""} alt="" className="size-12 rounded-xl border border-ink-100 object-cover" />
              <div>
                <p className="text-balance break-words text-sm font-semibold text-ink-900">{store.name}</p>
                <p className="text-xs text-ink-400">{store.city}, {store.state ?? "Akwa Ibom"}</p>
              </div>
            </div>

            <p className="mt-2 text-xs leading-6 text-ink-500">Sold and fulfilled by {store.name} in Akwa Ibom State.</p>
            <ButtonLink href={base || "/"} variant="secondary" className="mt-3 w-full">Visit storefront</ButtonLink>
          </Card>
          {!user ? (
            <Card className="card-pad">
              <p className="text-sm font-semibold text-ink-900">Sign in to check out</p>
              <p className="mt-1 text-xs leading-6 text-ink-500">
                Customer sign-in is required at checkout so you can choose dispatch or vendor shop pickup, receive your 6-digit Delivery PIN, and leave verified reviews.
              </p>
              <ButtonLink href={`/login?next=${encodeURIComponent(`/s/${slug}/products/${productSlug}`)}`} variant="ghost" className="mt-2 w-full">
                Sign in or create account
              </ButtonLink>
            </Card>
          ) : null}
          <Card className="card-pad">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900"><CheckCircle2 className="size-4 text-brand-600" /> Delivery-verified buyer protection</h3>
            <ul className="mt-2 space-y-1.5 text-xs leading-5 text-ink-500">
              <li>Choose dispatch delivery or free pickup at the vendor&apos;s Akwa Ibom location.</li>
              <li>Vendor payout is held until you share your secret 6-digit Delivery PIN or confirm receipt.</li>
              <li>Only verified Akwa Ibom merchants (NIN &amp; Proof of Residence checked).</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
