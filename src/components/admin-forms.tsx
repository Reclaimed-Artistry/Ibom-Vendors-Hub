"use client";

import { useActionState, useState } from "react";
import {
  adminMessageAction,
  grantSubscriptionAction,
  markPaymentRefundedAction,
  rejectStoreAction,
  retryFailedEmailsAction,
  reviewSubdomainRequestAction,
  saveCategoryAction,
  savePlanAction,
  savePlatformSettingsAction,
  sendTestEmailAction,
  suspendStoreAction,
  type AdminState,
} from "@/app/actions/admin";
import { Alert, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

function StateNote({ state }: { state: AdminState }) {
  if (state.error) return <Alert tone="danger">{state.error}</Alert>;
  if (state.message) return <Alert tone="success">{state.message}</Alert>;
  return null;
}

export function RejectStoreForm({ storeId }: { storeId: string }) {
  const [state, formAction] = useActionState<AdminState, FormData>(rejectStoreAction, {});
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="storeId" value={storeId} />
      <StateNote state={state} />
      <Field label="Reason (sent to the vendor)" htmlFor={`reject-${storeId}`} required>
        <textarea id={`reject-${storeId}`} name="reason" className="textarea" required />
      </Field>
      <SubmitButton className="btn-danger btn-sm" pendingLabel="Rejecting…">Reject application</SubmitButton>
    </form>
  );
}

export function SuspendStoreForm({ storeId }: { storeId: string }) {
  const [state, formAction] = useActionState<AdminState, FormData>(suspendStoreAction, {});
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="storeId" value={storeId} />
      <StateNote state={state} />
      <Field label="Suspension reason" htmlFor={`suspend-${storeId}`} required hint="Shown to the vendor. Data is retained.">
        <textarea id={`suspend-${storeId}`} name="reason" className="textarea" required />
      </Field>
      <SubmitButton className="btn-danger btn-sm" pendingLabel="Suspending…">Suspend store</SubmitButton>
    </form>
  );
}

export function GrantSubscriptionForm({ storeId, plans }: { storeId: string; plans: Array<{ id: string; name: string; price: number }> }) {
  const [state, formAction] = useActionState<AdminState, FormData>(grantSubscriptionAction, {});
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="storeId" value={storeId} />
      <StateNote state={state} />
      <Field label="Plan" htmlFor={`grant-plan-${storeId}`} required>
        <select id={`grant-plan-${storeId}`} name="planId" className="select" required>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>{plan.name} — ₦{Number(plan.price).toLocaleString()}</option>
          ))}
        </select>
      </Field>
      <Field label="Note (optional)" htmlFor={`grant-note-${storeId}`}>
        <input id={`grant-note-${storeId}`} name="note" className="input" placeholder="e.g. goodwill extension" />
      </Field>
      <SubmitButton className="btn-secondary btn-sm" pendingLabel="Granting…">Grant subscription</SubmitButton>
    </form>
  );
}

export function PlanForm({
  plan,
}: {
  plan?: { id: string; name: string; price: number; duration_days: number; product_limit: number | null; order_limit: number | null; features: string[]; is_active: boolean; is_featured: boolean };
}) {
  const [state, formAction] = useActionState<AdminState, FormData>(savePlanAction, {});
  return (
    <form action={formAction} className="space-y-3">
      {plan ? <input type="hidden" name="planId" value={plan.id} /> : null}
      <StateNote state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Plan name" htmlFor={`plan-name-${plan?.id ?? "new"}`} required>
          <input id={`plan-name-${plan?.id ?? "new"}`} name="name" className="input" defaultValue={plan?.name ?? ""} required />
        </Field>
        <Field label="Price (₦)" htmlFor={`plan-price-${plan?.id ?? "new"}`} required>
          <input id={`plan-price-${plan?.id ?? "new"}`} name="price" type="number" min="0" step="0.01" className="input" defaultValue={plan?.price ?? 0} required />
        </Field>
        <Field label="Duration (days)" htmlFor={`plan-duration-${plan?.id ?? "new"}`}>
          <input id={`plan-duration-${plan?.id ?? "new"}`} name="durationDays" type="number" min="1" className="input" defaultValue={plan?.duration_days ?? 30} />
        </Field>
        <Field label="Product limit" htmlFor={`plan-products-${plan?.id ?? "new"}`} hint="Leave empty for unlimited.">
          <input id={`plan-products-${plan?.id ?? "new"}`} name="productLimit" type="number" min="1" className="input" defaultValue={plan?.product_limit ?? ""} />
        </Field>
        <Field label="Order limit" htmlFor={`plan-orders-${plan?.id ?? "new"}`} hint="Leave empty for unlimited.">
          <input id={`plan-orders-${plan?.id ?? "new"}`} name="orderLimit" type="number" min="1" className="input" defaultValue={plan?.order_limit ?? ""} />
        </Field>
        <Field label="Feature list" htmlFor={`plan-features-${plan?.id ?? "new"}`} hint="One per line.">
          <textarea id={`plan-features-${plan?.id ?? "new"}`} name="features" className="textarea" defaultValue={(plan?.features ?? []).join("\n")} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-ink-700">
        <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={plan?.is_active ?? true} className="size-4 rounded border-ink-300" /> Active</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="isFeatured" defaultChecked={plan?.is_featured ?? false} className="size-4 rounded border-ink-300" /> Featured</label>
      </div>
      <SubmitButton className="btn-primary btn-sm" pendingLabel="Saving…">{plan ? "Save plan" : "Create plan"}</SubmitButton>
    </form>
  );
}

export function RefundForm({ reference, amount }: { reference: string; amount: number }) {
  const [state, formAction] = useActionState<AdminState, FormData>(markPaymentRefundedAction, {});
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => setOpen(true)}>
        Refund ₦{amount.toLocaleString()}
      </button>
    );
  }
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="reference" value={reference} />
      <StateNote state={state} />
      <Field label="Refund reason" htmlFor={`refund-${reference}`} required>
        <input id={`refund-${reference}`} name="reason" className="input" required />
      </Field>
      <div className="flex gap-2">
        <SubmitButton className="btn-danger btn-sm" pendingLabel="Processing…">Confirm refund</SubmitButton>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

const FEATURE_KEYS = [
  "catalogue", "cart", "stock", "variants", "addons", "prepTime", "operatingHours", "delivery", "pickup",
  "appointments", "quotations", "productionTracking", "customMeasurements", "madeToOrder", "warranty",
  "reviews", "serviceBooking", "sizeGuide", "scheduleOrders", "minOrder",
];

export interface AdminCategoryValues {
  id?: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  sortOrder: number;
  features: Record<string, boolean>;
  attributes: unknown;
  workflow: unknown;
  isActive: boolean;
}

export function AdminCategoryForm({ category }: { category?: AdminCategoryValues }) {
  const [state, formAction] = useActionState<AdminState, FormData>(saveCategoryAction, {});
  const [features, setFeatures] = useState<Record<string, boolean>>(category?.features ?? {});
  const [attributes, setAttributes] = useState(JSON.stringify(category?.attributes ?? [], null, 2));
  const [workflow, setWorkflow] = useState(JSON.stringify(category?.workflow ?? [], null, 2));
  const enabled = Object.entries(features).filter(([, on]) => on).map(([key]) => key);

  return (
    <form action={formAction} className="space-y-4">
      {category?.id ? <input type="hidden" name="categoryId" value={category.id} /> : null}
      <input type="hidden" name="attributesJson" value={attributes} />
      <input type="hidden" name="workflowJson" value={workflow} />
      <input type="hidden" name="featureKeys" value={FEATURE_KEYS.join(",")} />
      <StateNote state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor={`cat-name-${category?.id ?? "new"}`} required>
          <input id={`cat-name-${category?.id ?? "new"}`} name="name" className="input" defaultValue={category?.name ?? ""} required />
        </Field>
        <Field label="Slug" htmlFor={`cat-slug-${category?.id ?? "new"}`} required hint="Lowercase, hyphens only.">
          <input id={`cat-slug-${category?.id ?? "new"}`} name="slug" className="input" defaultValue={category?.slug ?? ""} required />
        </Field>
        <Field label="Icon name" htmlFor={`cat-icon-${category?.id ?? "new"}`} hint="Lucide icon, e.g. utensils.">
          <input id={`cat-icon-${category?.id ?? "new"}`} name="icon" className="input" defaultValue={category?.icon ?? ""} />
        </Field>
        <Field label="Sort order" htmlFor={`cat-sort-${category?.id ?? "new"}`}>
          <input id={`cat-sort-${category?.id ?? "new"}`} name="sortOrder" type="number" className="input" defaultValue={category?.sortOrder ?? 0} />
        </Field>
      </div>
      <Field label="Description" htmlFor={`cat-desc-${category?.id ?? "new"}`}>
        <textarea id={`cat-desc-${category?.id ?? "new"}`} name="description" className="textarea" defaultValue={category?.description ?? ""} />
      </Field>

      <div>
        <p className="label">Feature flags</p>
        <div className="grid gap-2 rounded-xl border border-ink-100 p-3 sm:grid-cols-3">
          {FEATURE_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                name={`feature_${key}`}
                checked={Boolean(features[key])}
                onChange={(event) => setFeatures((current) => ({ ...current, [key]: event.target.checked }))}
                className="size-4 rounded border-ink-300"
              />
              {key}
            </label>
          ))}
        </div>
        <p className="hint">Enabled: {enabled.length ? enabled.join(", ") : "nothing yet"} — these decide which storefront and product fields turn on for this category.</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Field label="Attributes (JSON array)" htmlFor={`cat-attrs-${category?.id ?? "new"}`} hint="key, label, type: text | select | number | boolean | textarea">
          <textarea id={`cat-attrs-${category?.id ?? "new"}`} className="textarea min-h-40 font-mono text-xs" value={attributes} onChange={(event) => setAttributes(event.target.value)} />
        </Field>
        <Field label="Workflow (JSON array)" htmlFor={`cat-flow-${category?.id ?? "new"}`} hint="Order stages, in order: key + label.">
          <textarea id={`cat-flow-${category?.id ?? "new"}`} className="textarea min-h-40 font-mono text-xs" value={workflow} onChange={(event) => setWorkflow(event.target.value)} />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-700">
        <input type="checkbox" name="isActive" defaultChecked={category?.isActive ?? true} className="size-4 rounded border-ink-300" /> Category active
      </label>
      <SubmitButton className="btn-primary" pendingLabel="Saving…">{category ? "Save category" : "Create category"}</SubmitButton>
    </form>
  );
}

export function SubdomainReviewForm({ requestId }: { requestId: string }) {
  const [state, formAction] = useActionState<AdminState, FormData>(reviewSubdomainRequestAction, {});
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="requestId" value={requestId} />
      <StateNote state={state} />
      <Field label="Admin note" htmlFor={`subnote-${requestId}`}>
        <input id={`subnote-${requestId}`} name="note" className="input" placeholder="Optional note to the vendor" />
      </Field>
      <div className="flex gap-2">
        <button type="submit" name="decision" value="approved" className="btn btn-primary btn-sm">Approve</button>
        <button type="submit" name="decision" value="rejected" className="btn btn-ghost btn-sm text-red-600">Reject</button>
      </div>
    </form>
  );
}

export function AdminMessageForm({ messageId }: { messageId: string }) {
  const [state, formAction] = useActionState<AdminState, FormData>(adminMessageAction, {});
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="messageId" value={messageId} />
      <StateNote state={state} />
      <textarea name="reply" className="textarea min-h-24" placeholder="Reply to the sender (optional)…" />
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="status" value="resolved" className="btn btn-primary btn-sm">Reply &amp; resolve</button>
        <button type="submit" name="status" value="open" className="btn btn-secondary btn-sm">Mark open</button>
        <button type="submit" name="status" value="closed" className="btn btn-ghost btn-sm">Close</button>
      </div>
    </form>
  );
}

export interface PlatformSettingsValues {
  platformName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  mainDomain: string;
  commissionRate: number;
  trialDays: number;
  graceDays: number;
  requireApproval: boolean;
  paymentsEnabled: boolean;
  sandboxPayments: boolean;
  maintenanceMode: boolean;
  paystackPublicKey: string;
  paystackSecretKey: string;
  emailFrom: string;
}

export function PlatformSettingsForm({ values }: { values: PlatformSettingsValues }) {
  const [state, formAction] = useActionState<AdminState, FormData>(savePlatformSettingsAction, {});
  return (
    <form action={formAction} className="space-y-4">
      <StateNote state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Platform name" htmlFor="platformName" required>
          <input id="platformName" name="platformName" className="input" defaultValue={values.platformName} required />
        </Field>
        <Field label="Tagline" htmlFor="tagline">
          <input id="tagline" name="tagline" className="input" defaultValue={values.tagline} />
        </Field>
        <Field label="Support email" htmlFor="supportEmail">
          <input id="supportEmail" name="supportEmail" type="email" className="input" defaultValue={values.supportEmail} />
        </Field>
        <Field label="Support phone" htmlFor="supportPhone">
          <input id="supportPhone" name="supportPhone" className="input" defaultValue={values.supportPhone} />
        </Field>
        <Field label="Main domain" htmlFor="mainDomain" hint="Used for links and subdomain routing.">
          <input id="mainDomain" name="mainDomain" className="input" defaultValue={values.mainDomain} />
        </Field>
        <Field label="Commission (%)" htmlFor="commissionRate">
          <input id="commissionRate" name="commissionRate" type="number" min="0" max="50" step="0.5" className="input" defaultValue={values.commissionRate} />
        </Field>
        <Field label="Trial days" htmlFor="trialDays">
          <input id="trialDays" name="trialDays" type="number" min="0" className="input" defaultValue={values.trialDays} />
        </Field>
        <Field label="Grace period (days)" htmlFor="graceDays">
          <input id="graceDays" name="graceDays" type="number" min="0" className="input" defaultValue={values.graceDays} />
        </Field>
        <Field label="Paystack public key" htmlFor="paystackPublicKey">
          <input id="paystackPublicKey" name="paystackPublicKey" className="input" defaultValue={values.paystackPublicKey} />
        </Field>
        <Field label="Paystack secret key" htmlFor="paystackSecretKey" hint="Stored server-side only; never sent to the browser.">
          <input id="paystackSecretKey" name="paystackSecretKey" type="password" className="input" defaultValue={values.paystackSecretKey} />
        </Field>
        <Field label="Email from address" htmlFor="emailFrom">
          <input id="emailFrom" name="emailFrom" className="input" defaultValue={values.emailFrom} />
        </Field>
      </div>
      <div className="grid gap-2 rounded-xl border border-ink-100 p-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" name="requireApproval" defaultChecked={values.requireApproval} className="size-4 rounded border-ink-300" /> Require vendor approval</label>
        <label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" name="paymentsEnabled" defaultChecked={values.paymentsEnabled} className="size-4 rounded border-ink-300" /> Payments enabled</label>
        <label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" name="sandboxPayments" defaultChecked={values.sandboxPayments} className="size-4 rounded border-ink-300" /> Sandbox payments (no real charge)</label>
        <label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" name="maintenanceMode" defaultChecked={values.maintenanceMode} className="size-4 rounded border-ink-300" /> Maintenance banner</label>
      </div>
      <SubmitButton className="btn-primary" pendingLabel="Saving…">Save platform settings</SubmitButton>
    </form>
  );
}

export function EmailTestForm({ defaultTo }: { defaultTo: string }) {
  const [state, formAction] = useActionState<AdminState, FormData>(sendTestEmailAction, {});
  return (
    <form action={formAction} className="card card-pad space-y-3">
      <div>
        <p className="text-sm font-semibold text-ink-900">Send a test message</p>
        <p className="text-xs text-ink-500">
          Uses the configured provider and from address, exactly like a real receipt. Leave the field empty to send to your own
          administrator address.
        </p>
      </div>
      <StateNote state={state} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-56 flex-1">
          <span className="label">Recipient</span>
          <input name="to" type="email" defaultValue={defaultTo} className="input" placeholder="you@example.com" />
        </label>
        <SubmitButton className="btn btn-primary" pendingLabel="Sending…">
          Send test email
        </SubmitButton>
      </div>
    </form>
  );
}

export function RetryEmailsButton() {
  return (
    <form action={retryFailedEmailsAction}>
      <SubmitButton className="btn btn-secondary btn-sm" pendingLabel="Retrying…">
        Retry failed messages
      </SubmitButton>
    </form>
  );
}
