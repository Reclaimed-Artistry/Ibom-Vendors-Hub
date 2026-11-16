import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Globe, Lock, ShieldCheck } from "lucide-react";
import { getVendorContext } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { storeBase } from "@/lib/storefront-base";
import { storefrontUrl } from "@/lib/domains";
import { formatDate } from "@/lib/utils";
import { Alert, Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { StoreSettingsForm, SubdomainRequestForm, type StoreSettingsValues } from "@/components/store-settings-form";

export const metadata: Metadata = { title: "Store profile · Vendor dashboard" };

export default async function VendorStorePage() {
  const { store, category } = await getVendorContext();
  const [base, pending] = await Promise.all([
    storeBase(store.slug),
    systemDb.maybeOne<{ requested_subdomain: string; status: string; created_at: string; admin_note: string | null }>(
      `select requested_subdomain, status, created_at, admin_note from subdomain_change_requests
        where store_id = $1 order by created_at desc limit 1`,
      [store.id],
    ),
  ]);

  const values: StoreSettingsValues = {
    name: store.name,
    tagline: store.tagline ?? "",
    description: store.description ?? "",
    email: store.email ?? "",
    phone: store.phone ?? "",
    whatsapp: store.whatsapp ?? "",
    website: store.website ?? "",
    address: store.address ?? "",
    city: store.city ?? "",
    state: store.state ?? "",
    acceptsDelivery: store.accepts_delivery,
    acceptsPickup: store.accepts_pickup,
    acceptsOrders: store.accepts_orders,
    deliveryFee: String(Number(store.delivery_fee ?? 0)),
    minimumOrder: String(Number(store.minimum_order ?? 0)),
    deliveryAreas: store.delivery_areas ?? "",
    prepTimeMinutes: String(store.prep_time_minutes ?? 30),
    operatingHours: store.operating_hours ?? {},
    logoUrl: store.logo_url ?? "",
    coverUrl: store.cover_url ?? "",
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Store profile"
        description="This is what customers see on your storefront, in search and on your store card."
        actions={
          <Link href={base} target="_blank" className="btn btn-secondary btn-sm">
            View storefront <ExternalLink className="size-3.5" />
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <StoreSettingsForm values={values} />
        </div>

        <div className="space-y-4">
          <Card className="card-pad space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Storefront address</p>
            <p className="break-all text-sm font-semibold text-ink-900">{storefrontUrl(store.slug)}</p>
            <p className="break-all text-xs text-ink-500">{base}</p>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <Badge tone={store.status === "active" ? "success" : store.status === "pending" ? "warning" : "danger"}>{store.status}</Badge>
              <Badge tone={store.visibility === "public" ? "info" : "neutral"}>{store.visibility}</Badge>
              {category ? <span className="text-xs text-ink-500">{category.name}</span> : null}
            </div>
            <p className="text-xs text-ink-400">Store ID {store.id.slice(0, 8)} · joined {formatDate(store.created_at)}</p>
          </Card>

          <Card>
            <CardHeader title="Change store address" description="Subdomain changes need platform approval." />
            <div className="card-pad space-y-3">
              {pending ? (
                <Alert tone={pending.status === "pending" ? "warning" : pending.status === "approved" ? "success" : "info"} title={`Request ${pending.status}`}>
                  <p>
                    Requested <span className="font-semibold">{pending.requested_subdomain}</span> on {formatDate(pending.created_at)}.
                    {pending.status === "approved" ? " It is now live." : pending.status === "pending" ? " An admin will review it shortly." : ""}
                  </p>
                  {pending.admin_note ? <p className="mt-1 text-xs">{pending.admin_note}</p> : null}
                </Alert>
              ) : null}
              {(!pending || pending.status !== "pending") ? (
                <SubdomainRequestForm currentSlug={store.slug} suggested={`${store.slug}-hub`} />
              ) : null}
              <p className="flex items-start gap-1.5 text-xs text-ink-400">
                <Lock className="mt-0.5 size-3.5 shrink-0" />
                Reserved names such as admin, api and support are blocked. Old links keep working for 30 days after an approved change.
              </p>
            </div>
          </Card>

          <Card className="card-pad space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-900"><Globe className="size-4 text-brand-600" /> Custom domain</p>
            <p className="text-sm text-ink-500">
              Your storefront is served at <span className="font-medium text-ink-700">{storefrontUrl(store.slug)}</span>. Ask the platform team if you need a branded domain pointed at your store.
            </p>
            <ContactPlatformLink />
          </Card>
        </div>
      </div>
    </div>
  );
}

function ContactPlatformLink() {
  return (
    <Link href="/vendor/messages" className="btn btn-ghost btn-sm" aria-label="Contact the platform team">
      <ShieldCheck className="size-3.5" /> Contact platform team
    </Link>
  );
}
