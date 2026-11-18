import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LifeBuoy, Store } from "lucide-react";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { LogoutButton } from "@/components/dashboard-nav";

export const metadata: Metadata = { title: "Vendor onboarding · Ibom Vendors Hub" };

export default async function VendorOnboardingPage() {
  const user = await requireUser(["vendor"]);
  const store = await systemDb.maybeOne<{ id: string }>(
    `select id from stores where owner_id = $1 limit 1`,
    [user.id],
  );
  if (store) redirect("/vendor");

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <PageHeader
        title="Finish setting up your Akwa Ibom storefront"
        description="Your vendor account is ready — complete your business details and KYC verification to launch your storefront. Registering and owning a store is absolutely free."
      />
      <Card className="card-pad space-y-4">
        <div className="flex items-start gap-3">
          <Store className="mt-0.5 size-4 shrink-0 text-brand-600" />
          <p className="text-sm text-ink-600">
            Click below to attach your business name, Akwa Ibom location, and verification details to{" "}
            <strong className="text-ink-900">{user.email}</strong>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/register" className="btn-primary">
            Complete storefront setup <ArrowRight className="size-4" />
          </Link>
          <Link href="/contact" className="btn-secondary">
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
