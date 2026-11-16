"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { requestSubdomainChangeAction, type ActionState } from "@/app/actions/auth";
import { saveStoreSettingsAction, type VendorState } from "@/app/actions/vendor";
import { Alert, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

const DAYS: Array<{ key: string; label: string }> = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

export interface StoreSettingsValues {
  name: string;
  tagline: string;
  description: string;
  email: string;
  phone: string;
  whatsapp: string;
  website: string;
  address: string;
  city: string;
  state: string;
  acceptsDelivery: boolean;
  acceptsPickup: boolean;
  acceptsOrders: boolean;
  deliveryFee: string;
  minimumOrder: string;
  deliveryAreas: string;
  prepTimeMinutes: string;
  operatingHours: Record<string, { open: string; close: string; closed: boolean }>;
  logoUrl: string;
  coverUrl: string;
}

export function StoreSettingsForm({ values }: { values: StoreSettingsValues }) {
  const [state, formAction] = useActionState<VendorState, FormData>(saveStoreSettingsAction, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="danger" title="Could not save">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success" title="Saved">{state.message}</Alert> : null}

      <section className="card card-pad space-y-4">
        <h2 className="text-base font-semibold text-ink-900">Storefront identity</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Store name" htmlFor="store-name" required error={state.fieldErrors?.name}>
            <input id="store-name" name="name" className="input" defaultValue={values.name} required maxLength={80} />
          </Field>
          <Field label="Tagline" htmlFor="store-tagline">
            <input id="store-tagline" name="tagline" className="input" defaultValue={values.tagline} maxLength={120} placeholder="One line customers remember" />
          </Field>
        </div>
        <Field label="About your store" htmlFor="store-description">
          <textarea id="store-description" name="description" className="textarea min-h-32" defaultValue={values.description} maxLength={3000} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Logo" htmlFor="logoFile" hint="Square image works best.">
            <input id="logoFile" name="logoFile" type="file" accept="image/png,image/jpeg,image/webp" className="input py-2" />
          </Field>
          <Field label="Cover photo" htmlFor="coverFile" hint="Wide image, at least 1200px.">
            <input id="coverFile" name="coverFile" type="file" accept="image/png,image/jpeg,image/webp" className="input py-2" />
          </Field>
        </div>
        <input type="hidden" name="logoUrl" value={values.logoUrl} />
        <input type="hidden" name="coverUrl" value={values.coverUrl} />
        {values.logoUrl || values.coverUrl ? (
          <div className="flex gap-3">
            {values.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={values.logoUrl} alt="Current logo" className="size-16 rounded-xl border border-ink-100 object-cover" />
            ) : null}
            {values.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={values.coverUrl} alt="Current cover" className="h-16 w-40 rounded-xl border border-ink-100 object-cover" />
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="card card-pad space-y-4">
        <h2 className="text-base font-semibold text-ink-900">Contact &amp; location</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Public email" htmlFor="store-email">
            <input id="store-email" name="email" type="email" className="input" defaultValue={values.email} />
          </Field>
          <Field label="Phone" htmlFor="store-phone">
            <input id="store-phone" name="phone" className="input" defaultValue={values.phone} />
          </Field>
          <Field label="WhatsApp" htmlFor="store-whatsapp">
            <input id="store-whatsapp" name="whatsapp" className="input" defaultValue={values.whatsapp} placeholder="+234…" />
          </Field>
          <Field label="Website" htmlFor="store-website">
            <input id="store-website" name="website" className="input" defaultValue={values.website} placeholder="https://" />
          </Field>
        </div>
        <Field label="Street address" htmlFor="store-address">
          <input id="store-address" name="address" className="input" defaultValue={values.address} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City" htmlFor="store-city">
            <input id="store-city" name="city" className="input" defaultValue={values.city} />
          </Field>
          <Field label="State" htmlFor="store-state">
            <input id="store-state" name="state" className="input" defaultValue={values.state} />
          </Field>
        </div>
      </section>

      <section className="card card-pad space-y-4">
        <h2 className="text-base font-semibold text-ink-900">Orders &amp; fulfilment</h2>
        <div className="flex flex-wrap gap-5 text-sm text-ink-700">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="acceptsOrders" defaultChecked={values.acceptsOrders} className="size-4 rounded border-ink-300" /> Accept new orders
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="acceptsDelivery" defaultChecked={values.acceptsDelivery} className="size-4 rounded border-ink-300" /> Offer delivery
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="acceptsPickup" defaultChecked={values.acceptsPickup} className="size-4 rounded border-ink-300" /> Offer pickup
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Delivery fee (₦)" htmlFor="store-delivery-fee">
            <input id="store-delivery-fee" name="deliveryFee" type="number" min="0" step="0.01" className="input" defaultValue={values.deliveryFee} />
          </Field>
          <Field label="Minimum order (₦)" htmlFor="store-minimum">
            <input id="store-minimum" name="minimumOrder" type="number" min="0" step="0.01" className="input" defaultValue={values.minimumOrder} />
          </Field>
          <Field label="Typical prep time (mins)" htmlFor="store-prep">
            <input id="store-prep" name="prepTimeMinutes" type="number" min="0" className="input" defaultValue={values.prepTimeMinutes} />
          </Field>
        </div>
        <Field label="Delivery areas" htmlFor="store-areas" hint="Comma separated, e.g. Uyo, Ikot Ekpene, Aba.">
          <input id="store-areas" name="deliveryAreas" className="input" defaultValue={values.deliveryAreas} />
        </Field>
      </section>

      <section className="card card-pad space-y-3">
        <div>
          <h2 className="text-base font-semibold text-ink-900">Opening hours</h2>
          <p className="text-sm text-ink-500">Customers see whether you are open right now.</p>
        </div>
        <div className="space-y-2">
          {DAYS.map((day) => {
            const slot = values.operatingHours?.[day.key] ?? { open: "09:00", close: "18:00", closed: false };
            return (
              <div key={day.key} className="grid items-center gap-2 sm:grid-cols-[8rem_1fr_1fr_7rem]">
                <span className="text-sm font-medium text-ink-700">{day.label}</span>
                <input name={`hours_${day.key}_open`} type="time" defaultValue={slot.open} className="input" aria-label={`${day.label} opening time`} />
                <input name={`hours_${day.key}_close`} type="time" defaultValue={slot.close} className="input" aria-label={`${day.label} closing time`} />
                <label className="flex items-center gap-2 text-xs text-ink-500">
                  <input type="checkbox" name={`hours_${day.key}_closed`} defaultChecked={slot.closed} className="size-4 rounded border-ink-300" /> Closed
                </label>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex justify-end">
        <SubmitButton className="btn-primary" pendingLabel="Saving…">Save changes</SubmitButton>
      </div>
    </form>
  );
}

function SubdomainSubmit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-secondary" disabled={pending}>
      {pending ? "Submitting…" : <>Request change <Check className="size-4" /></>}
    </button>
  );
}

export function SubdomainRequestForm({ currentSlug, suggested }: { currentSlug: string; suggested: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(requestSubdomainChangeAction, {});
  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}
      <Field label="Current address" htmlFor="current-subdomain">
        <input id="current-subdomain" className="input bg-ink-50" value={currentSlug} readOnly />
      </Field>
      <Field label="Requested address" htmlFor="requested-subdomain" hint="Letters, numbers and hyphens only. Admin approval is required.">
        <input id="requested-subdomain" name="subdomain" className="input" placeholder={suggested} maxLength={40} required />
      </Field>
      <Field label="Why do you need this change?" htmlFor="subdomain-reason">
        <textarea id="subdomain-reason" name="reason" className="textarea" maxLength={500} />
      </Field>
      <SubdomainSubmit />
    </form>
  );
}
