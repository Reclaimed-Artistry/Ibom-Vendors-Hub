import { ListingMedia } from "@/components/listing-media";
import { listingCategory } from "@/lib/category-policy";
import { NO_INDEX } from "@/lib/seo";
import { isPropertyCategory, inspectionSlots } from "@/lib/property-inspections";
import { InspectionBookingForm } from "@/components/inspection-forms";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStoreProduct, resolveStore } from "@/lib/storefront";
import { getSettings } from "@/lib/settings";
import { storeBase } from "@/lib/storefront-base";
import { getCurrentUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import { BookingForm } from "@/components/storefront-forms";
import { getCategoryBookingProfile } from "@/lib/artisan-bookings";

export const metadata = { robots: NO_INDEX, alternates: { canonical: null } };

export default async function BookPage({ params }: { params: Promise<{ slug: string; productSlug: string }> }) {
  const { slug, productSlug } = await params;
  const { store, category: primaryCategory, live } = await resolveStore(slug);
  if (!store) notFound();
  const product = await getStoreProduct(store.id, productSlug);
  if (!product) notFound();
  const category = listingCategory(product, primaryCategory);
  if (!product.is_available || category?.features?.inquiryOnly || (product.kind !== "service" && !category?.features?.serviceBooking)) notFound();
  const [base, settings, user] = await Promise.all([storeBase(slug), getSettings(), getCurrentUser()]);
  const profile = getCategoryBookingProfile(category?.slug);

  if (!live) {
    return (
      <div className="container-page max-w-lg py-16 text-center">
        <h1 className="font-display text-2xl">Bookings are closed</h1>
        <p className="mt-2 text-sm text-ink-500">{store.name} is offline right now. Please try again later.</p>
        <Link href={base || "/"} className="btn-primary mt-5">Back to storefront</Link>
      </div>
    );
  }

  if (isPropertyCategory(category?.slug)) {
    const slots = await inspectionSlots(product.id);
    return <div className="container-page max-w-2xl py-10 space-y-5">
      <Link href={`${base}/products/${product.slug}`} className="text-sm text-brand-700">← Back to property</Link>
      <Card className="card-pad space-y-3"><h1 className="text-2xl font-bold">Book inspection</h1><h2 className="font-semibold">{product.name}</h2>
        <p className="text-sm text-ink-500">{product.attributes?.listing_type} · {product.attributes?.property_location}</p>
        <p className="text-sm">Select a time the agent has published. Times shown are Nigeria time (WAT). The meeting point is separate from the property location.</p>
        {user ? <InspectionBookingForm slots={slots} fee={Number(product.attributes?.inspection_fee ?? 0)}/> : <Link className="btn-primary" href={`/login?next=${encodeURIComponent(`${base}/book/${product.slug}`)}`}>Sign in to book inspection</Link>}
      </Card>
    </div>;
  }

  return (
    <div className="container-page max-w-4xl py-10">
      <nav className="mb-4 text-xs text-ink-400">
        <Link href={base || "/"} className="break-words hover:text-ink-700">{store.name}</Link> /{" "}
        <Link href={`${base}/products/${product.slug}`} className="hover:text-ink-700">{product.name}</Link> /{" "}
        <span className="text-ink-600">{profile.isArtisan ? "Book artisan service" : "Book appointment"}</span>
      </nav>
      <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <ListingMedia src={product.images?.[0]?.url ?? "/images/seed/product-facial.svg"} mimeType={product.images?.[0]?.mime_type} alt={product.name} className="aspect-square w-full object-cover" />
            <div className="p-4">
              {category?.name ? (
                <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700">{category.name}</p>
              ) : null}
              <p className="mt-0.5 text-sm font-semibold text-ink-900">{product.name}</p>
              <p className="mt-1 text-xs leading-5 text-ink-500">{product.short_description ?? product.description}</p>
            </div>
          </Card>
          {profile.tradesCovered.length > 0 ? (
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-500"> Covered trades in this category</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {profile.tradesCovered.map((trade) => (
                  <span key={trade} className="rounded-full bg-ink-100 px-2.5 py-1 text-[11px] font-medium text-ink-700">
                    {trade}
                  </span>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
        <Card className="card-pad">
          <h1 className="text-xl font-bold text-ink-900">{profile.heading}</h1>
          <p className="mt-1 text-sm text-ink-500">{profile.subtitle}</p>
          <div className="mt-5">
            <BookingForm
              storeId={store.id}
              productId={product.id}
              productName={product.name}
              price={product.price}
              duration={product.service_duration_minutes}
              currencySymbol={settings.currency_symbol}
              categorySlug={category?.slug}
              defaultName={user?.fullName}
              defaultEmail={user?.email}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
