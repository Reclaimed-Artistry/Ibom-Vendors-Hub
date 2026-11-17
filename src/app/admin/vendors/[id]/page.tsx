import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, FileCheck2, Mail, MapPin, Phone, ShieldCheck, Store } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { getPlans, getStoreSubscription } from "@/lib/subscriptions";
import { storefrontUrl } from "@/lib/domains";
import { storeBase } from "@/lib/storefront-base";
import { proofOfResidenceLabel } from "@/lib/akwa-ibom";
import { formatMoney, formatDate, formatDateTime } from "@/lib/utils";
import { Badge, Card, CardHeader, PageHeader, StatCard } from "@/components/ui";
import {
  adminDeleteProductAction,
  adminDeleteStoreAction,
  restoreStoreAction,
  setStoreVisibilityAction,
  verifyVendorKycAction,
} from "@/app/actions/admin";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmSubmit } from "@/components/confirm-button";
import {
  GrantSubscriptionForm,
  SuspendStoreForm,
  WaiveSubscriptionForm,
} from "@/components/admin-forms";
import { KycDocumentReviewPanel } from "@/components/kyc-document-review";
import type { VendorProfile } from "@/lib/types";

export const metadata: Metadata = { title: "Vendor detail · Admin" };

export default async function AdminVendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const store = await systemDb.maybeOne<{
    id: string;
    name: string;
    slug: string;
    tagline: string | null;
    description: string | null;
    status: string;
    visibility: string;
    suspension_reason: string | null;
    rejection_reason: string | null;
    review_deadline_at: string | null;
    logo_url: string | null;
    cover_url: string | null;
    created_at: string;
    owner_id: string;
    owner_name: string;
    owner_email: string;
    owner_phone: string | null;
    category_name: string | null;
    email: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
    address: string | null;
  }>(
    `select s.*, u.full_name as owner_name, u.email as owner_email, u.phone as owner_phone, c.name as category_name
       from stores s join users u on u.id = s.owner_id left join store_categories c on c.id = s.category_id
      where s.id = $1`,
    [id],
  );
  if (!store) notFound();

  const [subscription, plans, stats, orders, products, logs, base, kyc] = await Promise.all([
    getStoreSubscription(store.id),
    getPlans(true),
    systemDb.maybeOne<{ orders: number; revenue: number; products: number; reviews: number; rating: number }>(
      `select (select count(*)::int from orders where store_id = $1) as orders,
              (select coalesce(sum(total),0)::numeric from orders where store_id = $1 and payment_status = 'paid') as revenue,
              (select count(*)::int from products where store_id = $1) as products,
              (select count(*)::int from reviews where store_id = $1 and status = 'published') as reviews,
              (select coalesce(avg(rating),0)::numeric from reviews where store_id = $1 and status = 'published') as rating`,
      [store.id],
    ),
    systemDb.query<{ id: string; reference: string; total: number; status: string; payment_status: string; created_at: string }>(
      `select id, reference, total, status, payment_status, created_at from orders where store_id = $1 order by created_at desc limit 6`,
      [store.id],
    ),
    systemDb.query<{ id: string; name: string; price: number; is_available: boolean }>(
      `select id, name, price, is_available from products where store_id = $1 order by created_at desc limit 24`,
      [store.id],
    ),
    systemDb.query<{ id: string; action: string; description: string | null; created_at: string; actor_role: string }>(
      `select id, action, description, created_at, actor_role from activity_logs where store_id = $1 order by created_at desc limit 10`,
      [store.id],
    ),
    storeBase(store.slug),
    systemDb.maybeOne<VendorProfile>(
      `select * from vendor_profiles where user_id = $1`,
      [store.owner_id],
    ),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={store.name}
        description={`${store.owner_name} · ${store.owner_email} · joined ${formatDate(store.created_at)}`}
        breadcrumb={<Link href="/admin/vendors" className="hover:text-brand-700">← Vendors</Link>}
        actions={
          <>
            <Badge tone={store.status === "active" ? "success" : store.status === "pending" ? "warning" : store.status === "expired" ? "neutral" : "danger"}>{store.status}</Badge>
            {store.status === "active" ? (
              <Link href={base} target="_blank" className="btn btn-secondary btn-sm">Storefront <ExternalLink className="size-3.5" /></Link>
            ) : null}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={formatMoney(Number(stats?.revenue ?? 0))} hint={`${stats?.orders ?? 0} orders`} />
        <StatCard label="Products" value={stats?.products ?? 0} hint={subscription?.plan.name ?? "No plan"} />
        <StatCard label="Rating" value={Number(stats?.rating ?? 0).toFixed(1)} hint={`${stats?.reviews ?? 0} reviews`} />
        <StatCard label="Subscription" value={subscription ? formatDate(subscription.expires_at) : "None"} hint={subscription?.status ?? "expired"} />
      </div>

      <Card>
        <CardHeader
          title={
            store.status === "pending"
              ? "48-Hour Storefront Document Review & Approval Decision"
              : "Registration Documents, Identity & CAC Verification"
          }
          description="Always inspect the uploaded Proof of Residence, NIN, CAC status, and business profile before approving a storefront."
        />
        <div className="card-pad space-y-4">
          <KycDocumentReviewPanel
            snapshot={{
              storeId: store.id,
              storeName: store.name,
              storeSlug: store.slug,
              storeStatus: store.status,
              createdAt: store.created_at,
              reviewDeadlineAt: store.review_deadline_at,
              ownerName: store.owner_name,
              ownerEmail: store.owner_email,
              ownerPhone: store.owner_phone ?? store.phone,
              categoryName: store.category_name,
              city: store.city,
              state: store.state,
              address: store.address,
              logoUrl: store.logo_url,
              coverUrl: store.cover_url,
              nin: kyc?.nin,
              proofOfResidenceType: kyc?.proof_of_residence_type,
              proofOfResidenceUrl: kyc?.proof_of_residence_url,
              cacRegistered: kyc?.cac_registered,
              cacNumber: kyc?.cac_number,
              kycStatus: kyc?.kyc_status,
            }}
            showDecisionActions={true}
          />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Storefront details" />
            <div className="card-pad grid gap-3 text-sm sm:grid-cols-2">
              <p className="flex items-center gap-2 text-ink-600"><Store className="size-4 text-ink-400" /> {storefrontUrl(store.slug)}</p>
              <p className="flex items-center gap-2 text-ink-600"><Mail className="size-4 text-ink-400" /> {store.email ?? store.owner_email}</p>
              <p className="flex items-center gap-2 text-ink-600"><Phone className="size-4 text-ink-400" /> {store.phone ?? store.owner_phone ?? "—"}</p>
              <p className="flex items-center gap-2 text-ink-600"><MapPin className="size-4 text-ink-400" /> {[store.address, store.city, store.state].filter(Boolean).join(", ") || "—"}</p>
              <p className="text-ink-500">Category: <span className="font-medium text-ink-800">{store.category_name ?? "—"}</span></p>
              <p className="text-ink-500">Visibility: <span className="font-medium text-ink-800">{store.visibility}</span></p>
            </div>
            {store.description ? <p className="card-pad pt-0 text-sm text-ink-600">{store.description}</p> : null}
            {store.suspension_reason ? <p className="mx-5 mb-4 rounded-lg bg-red-50 p-2 text-sm text-red-800">Suspended: {store.suspension_reason}</p> : null}
            {store.rejection_reason ? <p className="mx-5 mb-4 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">Rejected: {store.rejection_reason}</p> : null}
          </Card>

          <Card>
            <CardHeader
              title="Identity, Residence & CAC Verification"
              description="Akwa Ibom merchant KYC records submitted by the business owner."
            />
            <div className="card-pad space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  tone={
                    kyc?.kyc_status === "verified"
                      ? "success"
                      : kyc?.kyc_status === "rejected"
                        ? "danger"
                        : "info"
                  }
                >
                  KYC: {kyc?.kyc_status ?? "pending"}
                </Badge>
                <Badge tone="info">State: {store.state ?? "Akwa Ibom"}</Badge>
                <Badge tone={kyc?.cac_registered ? "success" : "neutral"}>
                  {kyc?.cac_registered ? `CAC Registered (${kyc.cac_number ?? "—"})` : "CAC: Not registered"}
                </Badge>
              </div>

              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-3">
                  <dt className="text-xs font-medium text-ink-500">National Identification Number (NIN)</dt>
                  <dd className="mt-1 font-mono text-sm font-semibold text-ink-900">{kyc?.nin || "Not submitted"}</dd>
                </div>
                <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-3">
                  <dt className="text-xs font-medium text-ink-500">CAC Registration</dt>
                  <dd className="mt-1 font-semibold text-ink-900">
                    {kyc?.cac_registered ? (
                      <span className="font-mono">{kyc.cac_number}</span>
                    ) : (
                      <span className="text-ink-600">No — operating as unregistered business</span>
                    )}
                  </dd>
                </div>
                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3 sm:col-span-2">
                  <dt className="text-xs font-medium text-emerald-900">Settlement Bank Account (Vendor Payouts)</dt>
                  <dd className="mt-1 text-sm text-ink-900">
                    {kyc?.bank_name && kyc?.account_number ? (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">
                          {kyc.bank_name} · <span className="font-mono">{kyc.account_number}</span>
                        </span>
                        <span className="text-xs font-medium text-ink-600">{kyc.account_name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-ink-500">Not added yet</span>
                    )}
                  </dd>
                </div>
                <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-3 sm:col-span-2">
                  <dt className="text-xs font-medium text-ink-500">Proof of Residence ({proofOfResidenceLabel(kyc?.proof_of_residence_type)})</dt>
                  <dd className="mt-1.5 flex items-center justify-between gap-2">
                    {kyc?.proof_of_residence_url ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 text-ink-800">
                          <FileCheck2 className="size-4 text-brand-700" /> Document uploaded
                        </span>
                        <a
                          href={kyc.proof_of_residence_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-brand-800 hover:underline"
                        >
                          Inspect proof of residence <ExternalLink className="size-3.5" />
                        </a>
                      </>
                    ) : (
                      <span className="text-ink-500">No proof of residence uploaded yet</span>
                    )}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {kyc?.kyc_status !== "verified" ? (
                  <form action={verifyVendorKycAction}>
                    <input type="hidden" name="storeId" value={store.id} />
                    <input type="hidden" name="decision" value="verified" />
                    <SubmitButton className="btn-primary btn-sm" pendingLabel="Verifying…">
                      <ShieldCheck className="size-3.5" /> Mark KYC verified
                    </SubmitButton>
                  </form>
                ) : null}
                <form action={verifyVendorKycAction} className="flex flex-1 items-center gap-2">
                  <input type="hidden" name="storeId" value={store.id} />
                  <input type="hidden" name="decision" value="rejected" />
                  <input
                    name="note"
                    className="input py-1.5 text-xs"
                    placeholder="Optional note if requesting KYC re-upload…"
                  />
                  <SubmitButton className="btn-secondary btn-sm shrink-0" pendingLabel="Sending…">
                    Request re-upload
                  </SubmitButton>
                </form>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader title="Recent orders" />
              <ul className="divide-y divide-ink-100">
                {orders.length === 0 ? <li className="px-5 py-3 text-sm text-ink-500">No orders yet.</li> : null}
                {orders.map((order) => (
                  <li key={order.id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                    <div>
                      <p className="font-mono text-xs text-ink-800">{order.reference}</p>
                      <p className="text-[11px] text-ink-400">{formatDateTime(order.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatMoney(Number(order.total))}</p>
                      <p className="text-[11px] text-ink-400">{order.payment_status}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardHeader title="Products" />
              <ul className="divide-y divide-ink-100">
                {products.length === 0 ? <li className="px-5 py-3 text-sm text-ink-500">No products yet.</li> : null}
                {products.map((product) => (
                  <li key={product.id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                    <span className="truncate text-ink-800">{product.name}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-ink-500">{formatMoney(Number(product.price))}</span>
                      <form action={adminDeleteProductAction}>
                        <input type="hidden" name="productId" value={product.id} />
                        <input type="hidden" name="storeId" value={store.id} />
                        <ConfirmSubmit
                          className="btn btn-ghost btn-sm text-red-600 hover:bg-red-50"
                          message={`Permanently delete product “${product.name}” from the site?`}
                        >
                          Delete
                        </ConfirmSubmit>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card>
            <CardHeader title="Store activity" />
            <ul className="divide-y divide-ink-100">
              {logs.map((entry) => (
                <li key={entry.id} className="px-5 py-2.5 text-sm">
                  <p className="font-medium text-ink-800">{entry.action}</p>
                  <p className="text-xs text-ink-400">{entry.description ?? entry.actor_role} · {formatDateTime(entry.created_at)}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Moderation" description="Suspension keeps all data intact." />
            <div className="card-pad space-y-4">
              {store.status === "pending" ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  Review the uploaded Proof of Residence and NIN above, then approve or decline within the 48-hour timer.
                </p>
              ) : null}
              {store.status === "active" ? <SuspendStoreForm storeId={store.id} /> : null}
              {store.status === "suspended" ? (
                <form action={restoreStoreAction}>
                  <input type="hidden" name="storeId" value={store.id} />
                  <SubmitButton className="btn-primary w-full" pendingLabel="Restoring…">Restore store</SubmitButton>
                </form>
              ) : null}
              <form action={setStoreVisibilityAction} className="flex items-end gap-2">
                <input type="hidden" name="storeId" value={store.id} />
                <label className="flex-1">
                  <span className="label">Marketplace visibility</span>
                  <select name="visibility" defaultValue={store.visibility} className="select">
                    <option value="public">Public</option>
                    <option value="unlisted">Unlisted</option>
                  </select>
                </label>
                <SubmitButton className="btn-secondary btn-sm" pendingLabel="Saving…">Save</SubmitButton>
              </form>
            </div>
          </Card>

          <Card>
            <CardHeader title="Subscription" description={subscription ? `${subscription.plan.name} · ends ${formatDate(subscription.expires_at)}` : "No active subscription"} />
            <div className="card-pad space-y-3">
              <GrantSubscriptionForm storeId={store.id} plans={plans.map((plan) => ({ id: plan.id, name: plan.name, price: Number(plan.price) }))} />
              <WaiveSubscriptionForm storeId={store.id} plans={plans.map((plan) => ({ id: plan.id, name: plan.name, price: Number(plan.price) }))} />
            </div>
          </Card>

          <Card className="border-red-200 bg-red-50/30">
            <CardHeader
              title="Delete storefront permanently"
              description="Removes this storefront, all its products, images, and records from the site completely."
            />
            <form action={adminDeleteStoreAction} className="card-pad space-y-3">
              <input type="hidden" name="storeId" value={store.id} />
              <input type="hidden" name="redirectTo" value="/admin/vendors?deleted=1" />
              <label className="block">
                <span className="label text-xs">Reason (optional, sent to owner)</span>
                <input
                  name="reason"
                  className="input bg-white text-xs"
                  placeholder="e.g. Duplicate or fraudulent registration"
                />
              </label>
              <ConfirmSubmit
                className="btn-danger w-full"
                message={`Permanently delete storefront “${store.name}” and all its products from the site? This cannot be undone.`}
              >
                Delete storefront permanently
              </ConfirmSubmit>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
