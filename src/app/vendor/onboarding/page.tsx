import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy, Store } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { LogoutButton } from "@/components/dashboard-nav";

export const metadata: Metadata = { title: "Vendor onboarding · Ibom Vendors Hub" };

/**
 * Landing page for a vendor account that has no storefront yet.
 *
 * A store is created by vendor registration, which also creates the account —
 * so pointing an already-signed-in vendor at /register would only produce a
 * duplicate-email error. Vendor access normally comes from that same
 * registration, which means this page is a safety net for accounts set up by
 * hand (or a store that was removed); support finishes the setup instead.
 */
export default async function VendorOnboardingPage() {
  await requireUser(["vendor"]);
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <PageHeader
        title="Your storefront isn't set up yet"
        description="Your account has vendor access, but no store is attached to it, so there is nothing to manage yet."
      />
      <Card className="card-pad space-y-4">
        <div className="flex items-start gap-3">
          <Store className="mt-0.5 size-4 shrink-0 text-brand-600" />
          <p className="text-sm text-ink-600">
            Storefronts are created when a business registers, and the subscription trial starts at that moment. Because
            accounts and stores are created together, support has to attach one to your existing account — it takes a
            minute and nothing is lost.
          </p>
        </div>
        <div className="rounded-xl bg-ink-50 p-3 text-xs text-ink-500">
          Registering a <span className="font-semibold text-ink-700">different</span> business? Sign out first, then use
          the vendor registration form — signing up again with the same email is rejected on purpose.
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/contact" className="btn-primary">
            <LifeBuoy className="size-4" /> Contact support
          </Link>
          <Link href="/" className="btn-secondary">
            Back to the marketplace
          </Link>
        </div>
        <div className="border-t border-ink-100 pt-3">
          <LogoutButton />
        </div>
      </Card>
    </div>
  );
}
