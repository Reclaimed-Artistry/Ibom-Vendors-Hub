import Link from "next/link";
import { notFound } from "next/navigation";
import { getStoreProduct, resolveStore } from "@/lib/storefront";
import { storeBase } from "@/lib/storefront-base";
import { getCurrentUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import { QuoteForm } from "@/components/storefront-forms";

export default async function ProductQuotePage({ params }: { params: Promise<{ slug: string; productSlug: string }> }) {
  const { slug, productSlug } = await params;
  const { store, category, live } = await resolveStore(slug);
  if (!store) notFound();
  const product = await getStoreProduct(store.id, productSlug);
  if (!product) notFound();
  const [base, user] = await Promise.all([storeBase(slug), getCurrentUser()]);

  if (!live) {
    return (
      <div className="container-page max-w-lg py-16 text-center">
        <h1 className="font-display text-2xl">Requests are closed</h1>
        <p className="mt-2 text-sm text-ink-500">{store.name} is offline right now.</p>
        <Link href={base || "/"} className="btn-primary mt-5">Back to storefront</Link>
      </div>
    );
  }

  return (
    <div className="container-page max-w-2xl py-10">
      <nav className="mb-4 text-xs text-ink-400">
        <Link href={base || "/"} className="hover:text-ink-700">{store.name}</Link> / <span className="text-ink-600">Request a quotation</span>
      </nav>
      <Card className="card-pad">
        <h1 className="text-xl font-bold text-ink-900">Request a quotation</h1>
        <p className="mt-1 text-sm text-ink-500">
          Tell {store.name} what you need. You will receive a written quotation you can accept or reject — no payment is taken now.
        </p>
        <div className="mt-5">
          <QuoteForm
            storeId={store.id}
            products={[{ id: product.id, name: product.name }]}
            selectedProductId={product.id}
            categorySlug={category?.slug}
            defaultName={user?.fullName}
            defaultEmail={user?.email}
          />
        </div>
      </Card>
    </div>
  );
}
