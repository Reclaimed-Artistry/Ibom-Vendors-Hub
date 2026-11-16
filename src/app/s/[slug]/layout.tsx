import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MapPin, ShieldCheck } from "lucide-react";
import { CartButton, CartDrawer } from "@/components/cart";
import { resolveStore } from "@/lib/storefront";
import { storeBase } from "@/lib/storefront-base";
import { Logo } from "@/components/logo";
import { CustomerAnnouncements } from "@/components/announcement-strip";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { store } = await resolveStore(slug);
  if (!store) return { title: "Store not found" };
  return {
    title: `${store.name} — ${store.tagline ?? "Online store"}`,
    description: store.description ?? undefined,
    openGraph: {
      title: store.name,
      description: store.tagline ?? store.description ?? undefined,
      images: store.cover_url ? [store.cover_url] : undefined,
    },
  };
}

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { store, category, live } = await resolveStore(slug);
  if (!store) notFound();
  const base = await storeBase(slug);
  const features = (category?.features ?? {}) as Record<string, boolean>;

  return (
    <div className="flex min-h-screen w-full max-w-full flex-col overflow-x-clip bg-ink-50">
      <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/95 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between gap-3">
          <Link href={base || "/"} className="flex min-w-0 items-center gap-2.5">
            <img src={store.logo_url ?? "/images/seed/logo-mamaput-kitchen.svg"} alt="" className="size-10 rounded-xl border border-ink-100 object-cover" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-ink-900 sm:text-base">{store.name}</span>
              <span className="flex items-center gap-1 text-[11px] text-ink-400">
                <MapPin className="size-3" /> {store.city ?? store.state ?? store.country}
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <Link href={base || "/"} className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100">Home</Link>
            <Link href={`${base}/products`} className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100">
              {features.serviceBooking && !features.cart ? "Services" : "Shop"}
            </Link>
            {features.cart ? (
              <Link href="/track" className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100">Track order</Link>
            ) : null}
            <Link href="/browse" className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100">Marketplace</Link>
          </nav>
          <div className="flex items-center gap-2">
            {features.cart ? <CartButton /> : null}
          </div>
        </div>
        {!live ? (
          <div className="bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900">
            {store.status === "pending"
              ? "This storefront is currently undergoing 48-hour merchant verification and will open for orders once approved."
              : store.status === "rejected"
                ? "This storefront is currently closed."
                : "This storefront is currently offline. You can view the catalogue but new orders are disabled."}
          </div>
        ) : null}
      </header>
      <CustomerAnnouncements storeId={store.id} />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-ink-100 bg-white py-8">
        <div className="container-page flex flex-col items-center justify-between gap-3 text-xs text-ink-400 sm:flex-row">
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-brand-600" />
            {store.name} is a verified vendor on Ibom Vendors Hub
          </p>
          <p className="flex items-center gap-2">
            Powered by
            <Logo height={22} />
          </p>
        </div>
      </footer>
      <CartDrawer base={base} />
    </div>
  );
}
