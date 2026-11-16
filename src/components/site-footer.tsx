import Link from "next/link";
import { Logo } from "@/components/logo";
import { getSettings } from "@/lib/settings";
import { getCategoriesWithCounts } from "@/lib/storefront";

export async function SiteFooter() {
  const [settings, categories] = await Promise.all([getSettings(), getCategoriesWithCounts()]);
  return (
    <footer className="mt-16 border-t border-ink-100 bg-white">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo height={54} />
          <p className="mt-4 max-w-xs text-sm leading-6 text-ink-500">{settings.tagline}</p>
          <p className="mt-4 text-sm text-ink-500">
            {settings.support_email}
            <br />
            {settings.support_phone}
          </p>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Marketplace</h3>
          <ul className="mt-3 space-y-2 text-sm text-ink-600">
            <li><Link className="hover:text-brand-800" href="/browse">All products</Link></li>
            <li><Link className="hover:text-brand-800" href="/stores">All vendors</Link></li>
            <li><Link className="hover:text-brand-800" href="/track">Track an order</Link></li>
            <li><Link className="hover:text-brand-800" href="/register">Open a storefront</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Categories</h3>
          <ul className="mt-3 space-y-2 text-sm text-ink-600">
            {categories.slice(0, 5).map((category) => (
              <li key={category.id}>
                <Link className="hover:text-brand-800" href={`/browse?category=${category.slug}`}>
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Company</h3>
          <ul className="mt-3 space-y-2 text-sm text-ink-600">
            <li><Link className="hover:text-brand-800" href="/about">About</Link></li>
            <li><Link className="hover:text-brand-800" href="/contact">Contact support</Link></li>
            <li><Link className="hover:text-brand-800" href="/terms">Terms of service</Link></li>
            <li><Link className="hover:text-brand-800" href="/privacy">Privacy policy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-100 py-5">
        <div className="container-page flex flex-col items-center justify-between gap-2 text-xs text-ink-400 sm:flex-row">
          <p>© {new Date().getFullYear()} {settings.platform_name}. All rights reserved.</p>
          <p>Built for Akwa Ibom businesses · Powered by {settings.platform_name}</p>
        </div>
      </div>
    </footer>
  );
}
