import Link from "next/link";
import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getCategoriesWithCounts } from "@/lib/storefront";
import { normalisePhone } from "@/lib/utils";

export async function SiteFooter() {
  const [user, settings, categories] = await Promise.all([
    getCurrentUser(),
    getSettings(),
    getCategoriesWithCounts(),
  ]);
  return (
    <footer className="mt-16 border-t border-ink-100 bg-white">
      <div data-scroll-reveal className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo height={54} />
          <p className="mt-4 max-w-xs text-sm leading-6 text-ink-500">{settings.tagline}</p>
          <p className="mt-4 text-sm text-ink-500">
            <a className="hover:text-brand-800" href={`mailto:${settings.support_email}`}>{settings.support_email}</a>
            <br />
            <a className="hover:text-brand-800" href={`tel:${normalisePhone(settings.support_phone)}`}>{settings.support_phone}</a>
          </p>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Marketplace</h3>
          <ul className="mt-3 space-y-2 text-sm text-ink-600">
            <li><Link className="hover:text-brand-800" href="/browse">All products</Link></li>
            <li><Link className="hover:text-brand-800" href="/stores">All vendors</Link></li>
            <li><Link className="hover:text-brand-800" href="/sell">Sell online — free storefront</Link></li>
            <li><Link className="hover:text-brand-800" href="/track">Track an order</Link></li>
            {!user ? (
              <li><Link className="hover:text-brand-800" href="/register/customer">Sign in / Create account</Link></li>
            ) : user.role === "customer" ? (
              <li><Link className="font-medium text-brand-800 hover:text-brand-900" href="/register">Create a storefront</Link></li>
            ) : user.role === "vendor" ? (
              <li><Link className="hover:text-brand-800" href="/vendor">Vendor dashboard</Link></li>
            ) : (
              <li><Link className="hover:text-brand-800" href="/admin">Admin console</Link></li>
            )}
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
