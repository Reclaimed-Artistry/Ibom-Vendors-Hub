import { directBooking, listingActionLabel, storeFeatures } from "@/lib/category-policy";
import { JsonLd } from "@/components/json-ld";
import { storeStructuredData } from "@/lib/structured-data";
import { StoreStockCarousel } from "@/components/store-stock-carousel";
import { StoreImage } from "@/components/store-image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Mail, MapPin, Phone, Star, Store as StoreIcon, CalendarClock, FileText, ClipboardCheck, CheckCircle2 } from "lucide-react";
import { resolveStore, getStoreProducts, getStoreReviews, storeOpenState } from "@/lib/storefront";
import { getSettings } from "@/lib/settings";
import { storeBase } from "@/lib/storefront-base";
import { formatMoney, formatDate, truncate, normalisePhone } from "@/lib/utils";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { ContactForm } from "@/components/contact-form";
import { getCategoryBookingProfile } from "@/lib/artisan-bookings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StorefrontHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { store, category, live, reason } = await resolveStore(slug);
  if (!store) notFound();

  const [settings, base, reviews] = await Promise.all([getSettings(), storeBase(slug), getStoreReviews(store.id, 3)]);
  const { products } = await getStoreProducts({ storeId: store.id, limit: 48, includeUnavailable: false });
  const categories = await (await import("@/lib/db")).withPublic(async (db) =>
    db.query<{ id: string; name: string; slug: string; sort_order: number }>(
      `select id, name, slug, sort_order from product_categories where store_id = $1 and is_active order by sort_order, name`,
      [store.id],
    ),
  );
  const openState = storeOpenState(store.operating_hours);
  const businessCategories = store.business_categories ?? (category ? [category] : []);
  const features = storeFeatures(businessCategories, category);
  const propertyOnly = businessCategories.length === 1 && features.propertyListings;
  const money = (value: number) => formatMoney(value, settings.currency, settings.currency_symbol);

  if (!live) {
    return (
      <div className="container-page py-20">
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <StoreIcon className="size-7" />
          </div>
          <h1 className="mt-4 text-balance break-words font-display text-3xl text-ink-900">{store.name} is offline</h1>
          <p className="mt-2 text-sm leading-7 text-ink-500">{reason ?? "This storefront is not available right now."}</p>
          <p className="mt-2 text-xs text-ink-400">Products, order history and customer records are safe — nothing has been deleted.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <ButtonLink href="/browse">Browse other vendors</ButtonLink>
            <ButtonLink href="/vendor/subscription" variant="secondary">Store owner? Renew here</ButtonLink>
          </div>
        </div>
      </div>
    );
  }

  const availableStock = products.filter((product) => product.kind === "service" || !product.track_stock || product.stock_quantity > 0);
  const featured = products.filter((product) => product.is_featured).slice(0, 4);
  const showcase = featured.length ? featured : products.slice(0, 4);

  return (
    <div>
      <JsonLd data={storeStructuredData(store, category)} />
      {/* Cover */}
      <section className="relative">
        <div className="h-56 w-full overflow-hidden bg-ink-800 sm:h-72">
          <StoreImage kind="cover" src={store.cover_url} alt="" className="size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-900/70 via-ink-900/10 to-transparent" />
        </div>
        <div className="container-page relative -mt-16 pb-6">
          <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-white p-4 shadow-lg">
            <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
              <StoreImage kind="logo" src={store.logo_url} alt={store.name} className="size-20 rounded-2xl border-4 border-white bg-white object-cover shadow-lg sm:size-24" />
              <div className="min-w-0 flex-1 pb-1">
                <h1 className="text-balance break-words hyphens-auto font-display text-xl leading-snug text-ink-900 sm:text-3xl">{store.name}</h1>
                <p className="text-sm text-ink-500">{store.tagline}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-ink-500">
                  <span className="inline-flex items-center gap-1 font-semibold text-gold-600">
                    <Star className="size-3.5 fill-current" /> {store.rating_count > 0 ? `${store.rating_avg} (${store.rating_count} reviews)` : "New vendor"}
                  </span>
                  <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" /> {store.address ? `${store.address}, ` : ""}{store.city}, {store.state}</span>
                  <span className={`inline-flex items-center gap-1 font-medium ${openState.open ? "text-brand-700" : "text-red-600"}`}>
                    <Clock className="size-3.5" /> {openState.label}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pb-1">
              {features.prepTime && store.prep_time_minutes ? (
                <span className="badge-neutral"><Clock className="size-3.5" /> ~{store.prep_time_minutes} min prep</span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {availableStock.length > 0 ? (
        <section className="container-page pb-8" aria-label="Store catalogue highlights">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-xl text-ink-900">{propertyOnly ? "Explore properties for rent & sale" : "Explore our products & services"}</h2>
            <Link href={`${base}/products`} className="text-sm font-semibold text-brand-800">View all →</Link>
          </div>
          <StoreStockCarousel items={availableStock.map((product) => ({
            id: product.id,
            href: directBooking(product, category) ? `${base}/book/${product.slug}` : `${base}/products/${product.slug}`,
            name: product.name,
            image: product.images?.[0]?.url || null,
            summary: product.short_description || product.description || "",
            price: product.pricing_type === "quotation" ? "Request quote" : `${product.pricing_type === "from" ? "From " : ""}${money(product.price)}`,
            service: directBooking(product, category),
          }))} />
        </section>
      ) : null}

      <div className="container-page grid gap-8 pb-12 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          {businessCategories.length ? (
            <div className="flex flex-wrap gap-2">
              {businessCategories.map(item => <Badge key={item.id} tone="info">{item.name}</Badge>)}
              {features.madeToOrder ? <Badge tone="warning">Made to order</Badge> : null}
              {features.productionTracking ? <Badge tone="neutral">Production tracking</Badge> : null}
              {features.quotations ? <Badge tone="neutral">Quotations</Badge> : null}
              {features.appointments ? <Badge tone="neutral">Appointments</Badge> : null}
            </div>
          ) : null}

          {(() => {
            const bookingProfile = getCategoryBookingProfile(category?.slug);
            if (!bookingProfile.isArtisan) return null;
            return (
              <Card className="border-brand-200 bg-brand-50/60 p-5">
                <div className="flex items-start gap-3">
                  <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-brand-700" />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-bold text-ink-900">{bookingProfile.requirementsTitle}</h2>
                    <p className="mt-1 text-xs text-ink-600">
                      Before booking a site visit, repair or installation with {store.name}, please note:
                    </p>
                    <ul className="mt-2.5 grid gap-1.5 text-xs leading-5 text-ink-800 sm:grid-cols-2">
                      {bookingProfile.requirements.map((req, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-brand-700" />
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            );
          })()}

          <section>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl text-ink-900">{propertyOnly ? "Available properties" : features.serviceBooking && !features.cart ? "Popular services" : "Featured items"}</h2>
              <Link href={`${base}/products`} className="text-sm font-semibold text-brand-800 hover:text-brand-900">View all →</Link>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {showcase.map((product) => (
                <Link key={product.id} href={directBooking(product, category) ? `${base}/book/${product.slug}` : `${base}/products/${product.slug}`} className="group card overflow-hidden">
                  <div className="relative aspect-[4/3] overflow-hidden bg-ink-100">
                    <img src={product.images?.[0]?.url ?? "/images/seed/product-jollof.svg"} alt={product.name} className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    {product.made_to_order ? (
                      <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-800">Made to order</span>
                    ) : null}
                  </div>
                  <div className="p-4">
                    <p className="line-clamp-1 text-sm font-semibold text-ink-900">{product.name}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-ink-500">{truncate(product.short_description ?? product.description, 80)}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-bold text-ink-900">
                        {product.pricing_type === "quotation" ? "Request quote" : `${product.pricing_type === "from" ? "From " : ""}${money(product.price)}`}
                      </span>
                      {product.service_duration_minutes ? <span className="text-[11px] text-ink-400">{product.service_duration_minutes} min</span> : null}
                      {product.kind === "service" ? <span className="rounded-lg bg-brand-800 px-3 py-2 text-xs font-semibold text-white">{listingActionLabel(product, category)}</span> : null}
                    </div>
                  </div>
                </Link>
              ))}
              {showcase.length === 0 ? <p className="text-sm text-ink-500">This vendor has not published any listings yet.</p> : null}
            </div>
          </section>

          {categories.map((group) => {
            const groupProducts = products.filter((product) => product.category_id === group.id);
            if (!groupProducts.length) return null;
            return (
              <section key={group.id}>
                <h2 className="font-display text-xl text-ink-900">{group.name}</h2>
                <div className="mt-4 divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 bg-white">
                  {groupProducts.map((product) => (
                    <Link key={product.id} href={`${base}/products/${product.slug}`} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-ink-50">
                      <img src={product.images?.[0]?.url ?? "/images/seed/product-jollof.svg"} alt="" className="size-14 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink-900">{product.name}</p>
                        <p className="line-clamp-1 text-xs text-ink-400">{truncate(product.description, 70)}</p>
                      </div>
                      <span className="whitespace-nowrap text-sm font-semibold text-ink-900">
                        {product.pricing_type === "quotation" ? "Quote" : money(product.price)}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}

          <section>
            <h2 className="text-balance break-words font-display text-xl text-ink-900">About {store.name}</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-7 text-ink-600">{store.description}</p>
          </section>

          {reviews.length ? (
            <section>
              <h2 className="font-display text-xl text-ink-900">Customer reviews</h2>
              <div className="mt-4 space-y-3">
                {reviews.map((review) => (
                  <Card key={review.id} className="card-pad">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-ink-900">{review.customer_name}</p>
                      <span className="text-xs text-gold-600">{"★".repeat(review.rating)}<span className="text-ink-200">{"★".repeat(5 - review.rating)}</span></span>
                    </div>
                    {review.title ? <p className="mt-1 text-sm font-medium text-ink-800">{review.title}</p> : null}
                    <p className="mt-1 text-sm leading-6 text-ink-600">{review.comment}</p>
                    <p className="mt-2 text-[11px] text-ink-400">{formatDate(review.created_at)}</p>
                    {review.vendor_response ? (
                      <div className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-900">
                        <span className="font-semibold">Vendor response: </span>{review.vendor_response}
                      </div>
                    ) : null}
                  </Card>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card className="card-pad">
            <h2 className="text-sm font-semibold text-ink-900">Store details</h2>
            <ul className="mt-3 space-y-2.5 text-sm text-ink-600">
              {store.phone ? <li className="flex items-center gap-2"><Phone className="size-4 text-ink-400" /> <a className="hover:text-brand-800" href={`tel:${normalisePhone(store.phone)}`}>{store.phone}</a></li> : null}
              {store.email ? <li className="flex items-center gap-2 break-all"><Mail className="size-4 text-ink-400" /> {store.email}</li> : null}
              <li className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 text-ink-400" /> {store.address ? `${store.address}, ` : ""}{store.city}, {store.state}</li>
              {features.operatingHours ? <li className="flex items-start gap-2"><CalendarClock className="mt-0.5 size-4 text-ink-400" /> {openState.label}</li> : null}
              {store.minimum_order > 0 ? <li className="text-xs text-ink-500">Minimum order: {money(store.minimum_order)}</li> : null}
            </ul>
            <div className="mt-4 grid gap-2">
              <ButtonLink href={`${base}/products`} variant="secondary">Browse catalogue</ButtonLink>
              {features.quotations ? <ButtonLink href={`${base}/quote`} variant="ghost"><FileText className="size-4" /> Request a quotation</ButtonLink> : null}
            </div>
          </Card>

          <Card className="card-pad">
            <h2 className="text-sm font-semibold text-ink-900">Contact {store.name}</h2>
            <p className="mt-1 text-xs text-ink-500">Send a message — the vendor replies by email.</p>
            <div className="mt-3">
              <ContactForm storeId={store.id} storeName={store.name} />
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
