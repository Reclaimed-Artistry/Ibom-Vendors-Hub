import Link from "next/link";
import { notFound } from "next/navigation";
import { getStoreProducts, resolveStore } from "@/lib/storefront";
import { storeBase } from "@/lib/storefront-base";
import { getCurrentUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import { QuoteForm } from "@/components/storefront-forms";

export default async function StoreQuotePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { store, live } = await resolveStore(slug);
  if (!store) notFound();
  const [base, user, { products }] = await Promise.all([
    storeBase(slug),
    getCurrentUser(),
    getStoreProducts({ storeId: store.id, limit: 40, includeUnavailable: false }),
  ]);

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
          Describe the job and {store.name} will send a written quote you can accept or reject.
        </p>
        <div className="mt-5">
          <QuoteForm
            storeId={store.id}
            products={products.map((product) => ({ id: product.id, name: product.name }))}
            defaultName={user?.fullName}
            defaultEmail={user?.email}
          />
        </div>
      </Card>
    </div>
  );
}
