import type { Metadata } from "next";
import Link from "next/link";
import { Store } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { LogoutButton } from "@/components/dashboard-nav";

export const metadata: Metadata = { title: "Vendor onboarding · Ibom Vendors Hub" };

export default async function VendorOnboardingPage() {
  await requireUser(["vendor"]);
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <PageHeader title="Set up your store" description="Your vendor account does not have a storefront yet." />
      <Card className="card-pad space-y-3">
        <p className="flex items-center gap-2 text-sm text-ink-600">
          <Store className="size-4 text-brand-600" /> Storefronts are created when you register as a vendor, with your 14-day trial starting immediately.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/register/vendor" className="btn btn-primary">Create a storefront</Link>
          <Link href="/contact" className="btn btn-secondary">Contact support</Link>
        </div>
        <div className="border-t border-ink-100 pt-3"><LogoutButton /></div>
      </Card>
    </div>
  );
}
