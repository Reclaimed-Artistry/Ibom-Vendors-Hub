import Link from "next/link";
import { VendorRegisterForm } from "@/components/auth-forms";
import { getSettings } from "@/lib/settings";
import { getStoreCategories } from "@/lib/storefront";

export const metadata = { title: "Open your storefront" };

export default async function RegisterVendorPage() {
  const [categories, settings] = await Promise.all([getStoreCategories(), getSettings()]);
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Vendor registration</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Open your storefront</h1>
      <p className="mt-1.5 text-sm text-ink-500">
        {settings.default_trial_days}-day free trial · your own subdomain · no setup fee.
      </p>
      <div className="mt-6">
        <VendorRegisterForm categories={categories.map((category) => ({ slug: category.slug, name: category.name }))} />
      </div>
      <p className="mt-6 text-sm text-ink-500">
        Already registered? <Link href="/login" className="font-semibold text-brand-800 hover:text-brand-900">Sign in</Link>
      </p>
    </div>
  );
}
