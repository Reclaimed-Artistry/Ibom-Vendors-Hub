import Link from "next/link";
import { notFound } from "next/navigation";
import { getStoreProduct, resolveStore } from "@/lib/storefront";
import { getSettings } from "@/lib/settings";
import { storeBase } from "@/lib/storefront-base";
import { getCurrentUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import { BookingForm } from "@/components/storefront-forms";

export default async function BookPage({ params }: { params: Promise<{ slug: string; productSlug: string }> }) {
  const { slug, productSlug } = await params;
  const { store, live } = await resolveStore(slug);
  if (!store) notFound();
  const product = await getStoreProduct(store.id, productSlug);
  if (!product) notFound();
  const [base, settings, user] = await Promise.all([storeBase(slug), getSettings(), getCurrentUser()]);

  if (!live) {
    return (
      <div className="container-page max-w-lg py-16 text-center">
        <h1 className="font-display text-2xl">Bookings are closed</h1>
        <p className="mt-2 text-sm text-ink-500">{store.name} is offline right now. Please try again later.</p>
        <Link href={base || "/"} className="btn-primary mt-5">Back to storefront</Link>
      </div>
    );
  }

  return (
    <div className="container-page max-w-3xl py-10">
      <nav className="mb-4 text-xs text-ink-400">
        <Link href={base || "/"} className="hover:text-ink-700">{store.name}</Link> / <span className="text-ink-600">Book appointment</span>
      </nav>
      <div className="grid gap-6 sm:grid-cols-[0.85fr_1.15fr]">
        <Card className="overflow-hidden">
          <img src={product.images?.[0]?.url ?? "/images/seed/product-facial.svg"} alt={product.name} className="aspect-square w-full object-cover" />
          <div className="p-4">
            <p className="text-sm font-semibold text-ink-900">{product.name}</p>
            <p className="mt-1 text-xs leading-5 text-ink-500">{product.short_description ?? product.description}</p>
          </div>
        </Card>
        <Card className="card-pad">
          <h1 className="text-xl font-bold text-ink-900">Book an appointment</h1>
          <p className="mt-1 text-sm text-ink-500">Choose a time that works and {store.name} will confirm by email.</p>
          <div className="mt-4">
            <BookingForm
              storeId={store.id}
              productId={product.id}
              productName={product.name}
              price={product.price}
              duration={product.service_duration_minutes}
              currencySymbol={settings.currency_symbol}
              defaultName={user?.fullName}
              defaultEmail={user?.email}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
