"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, ExternalLink, FileCheck2, ShieldCheck } from "lucide-react";
import { deleteOwnStoreAction, saveStoreSettingsAction, saveVendorKycAction, type VendorState } from "@/app/actions/vendor";
import { requestSubdomainChangeAction, type ActionState } from "@/app/actions/auth";
import { AKWA_IBOM_LGAS, AKWA_IBOM_STATE, PROOF_OF_RESIDENCE_TYPES } from "@/lib/akwa-ibom";
import { Alert, Badge, Field } from "@/components/ui";
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

export interface VendorKycValues {
  nin: string;
  proofOfResidenceType: string;
  proofOfResidenceUrl: string;
  cacRegistered: boolean;
  cacNumber: string;
  kycStatus: "pending" | "submitted" | "verified" | "rejected";
  kycNote: string | null;
}

export function StoreSettingsForm({ values }: { values: StoreSettingsValues }) {
  const [state, formAction] = useActionState<VendorState, FormData>(saveStoreSettingsAction, {});

  const currentCity = values.city || "Uyo";
  const cityOptions = AKWA_IBOM_LGAS.includes(currentCity as (typeof AKWA_IBOM_LGAS)[number])
    ? AKWA_IBOM_LGAS
    : ([currentCity, ...AKWA_IBOM_LGAS] as const);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <input type="hidden" name="logoUrl" value={values.logoUrl} />
      <input type="hidden" name="coverUrl" value={values.coverUrl} />

      <section className="card card-pad space-y-4">
        <div>
          <h2 className="text-base font-semibold text-ink-900">Brand &amp; story</h2>
          <p className="text-sm text-ink-500">Displayed on your storefront header and on marketplace cards.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" htmlFor="store-name" required error={state.fieldErrors?.name}>
            <input id="store-name" name="name" className="input" defaultValue={values.name} required maxLength={120} />
          </Field>
          <Field label="Short tagline" htmlFor="store-tagline" hint="One crisp line under your name." error={state.fieldErrors?.tagline}>
            <input id="store-tagline" name="tagline" className="input" defaultValue={values.tagline} maxLength={160} placeholder="Fresh bakes from Uyo every morning" />
          </Field>
        </div>
        <Field label="About your business" htmlFor="store-description" error={state.fieldErrors?.description}>
          <textarea id="store-description" name="description" rows={4} className="textarea" defaultValue={values.description} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Logo (square works best)" htmlFor="logoFile">
            <input id="logoFile" name="logoFile" type="file" accept="image/png,image/jpeg,image/webp" className="input py-2 text-xs" />
          </Field>
          <Field label="Cover banner (wide)" htmlFor="coverFile">
            <input id="coverFile" name="coverFile" type="file" accept="image/png,image/jpeg,image/webp" className="input py-2 text-xs" />
          </Field>
        </div>
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
        <div>
          <h2 className="text-base font-semibold text-ink-900">Akwa Ibom location &amp; contact</h2>
          <p className="text-sm text-ink-500">
            All storefronts on Ibom Vendors Hub operate in <strong>Akwa Ibom State</strong>. Customers who select pickup at checkout see your street address below.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Public email" htmlFor="store-email" error={state.fieldErrors?.email}>
            <input id="store-email" name="email" type="email" className="input" defaultValue={values.email} />
          </Field>
          <Field label="Phone" htmlFor="store-phone" error={state.fieldErrors?.phone}>
            <input id="store-phone" name="phone" className="input" defaultValue={values.phone} placeholder="+234 800 000 0000" />
          </Field>
          <Field label="WhatsApp number" htmlFor="store-whatsapp" error={state.fieldErrors?.whatsapp}>
            <input id="store-whatsapp" name="whatsapp" className="input" defaultValue={values.whatsapp} placeholder="+234 800 000 0000" />
          </Field>
          <Field label="Website or social link" htmlFor="store-website" error={state.fieldErrors?.website}>
            <input id="store-website" name="website" className="input" defaultValue={values.website} placeholder="https://instagram.com/yourstore" />
          </Field>
        </div>
        <Field
          label="Physical business / pickup street address (Akwa Ibom)"
          htmlFor="store-address"
          required
          error={state.fieldErrors?.address}
          hint="Shown to customers when they choose 'Pick up from vendor's location'"
        >
          <input id="store-address" name="address" className="input" defaultValue={values.address} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="LGA / Town in Akwa Ibom" htmlFor="store-city" required error={state.fieldErrors?.city}>
            <select id="store-city" name="city" className="select" defaultValue={currentCity} required>
              {cityOptions.map((lga) => (
                <option key={lga} value={lga}>{lga}</option>
              ))}
            </select>
          </Field>
          <Field label="State" htmlFor="store-state" hint="Locked to Akwa Ibom State" required error={state.fieldErrors?.state}>
            <input
              id="store-state"
              name="state"
              className="input bg-ink-50 font-semibold text-ink-800 cursor-not-allowed"
              value={AKWA_IBOM_STATE}
              readOnly
            />
          </Field>
        </div>
      </section>

      <section className="card card-pad space-y-4">
        <div>
          <h2 className="text-base font-semibold text-ink-900">Ordering &amp; fulfilment</h2>
          <p className="text-sm text-ink-500">Control whether customers can use a dispatch rider, pick up from your location, or both.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex items-start gap-2.5 rounded-xl border border-ink-200 p-3 text-sm">
            <input type="checkbox" name="acceptsOrders" defaultChecked={values.acceptsOrders} className="mt-1 size-4 rounded border-ink-300" />
            <span><span className="block font-medium text-ink-900">Accept online orders</span><span className="text-xs text-ink-500">Turn off to pause checkout temporarily.</span></span>
          </label>
          <label className="flex items-start gap-2.5 rounded-xl border border-ink-200 p-3 text-sm">
            <input type="checkbox" name="acceptsDelivery" defaultChecked={values.acceptsDelivery} className="mt-1 size-4 rounded border-ink-300" />
            <span><span className="block font-medium text-ink-900">Offer dispatch delivery</span><span className="text-xs text-ink-500">Dispatch fee added at checkout.</span></span>
          </label>
          <label className="flex items-start gap-2.5 rounded-xl border border-ink-200 p-3 text-sm">
            <input type="checkbox" name="acceptsPickup" defaultChecked={values.acceptsPickup} className="mt-1 size-4 rounded border-ink-300" />
            <span><span className="block font-medium text-ink-900">Customer pickup at store</span><span className="text-xs text-ink-500">Free pickup at your Akwa Ibom address.</span></span>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Dispatch delivery fee (₦)" htmlFor="store-delivery-fee">
            <input id="store-delivery-fee" name="deliveryFee" type="number" min="0" step="0.01" className="input" defaultValue={values.deliveryFee} />
          </Field>
          <Field label="Minimum order (₦)" htmlFor="store-minimum">
            <input id="store-minimum" name="minimumOrder" type="number" min="0" step="0.01" className="input" defaultValue={values.minimumOrder} />
          </Field>
          <Field label="Typical prep time (mins)" htmlFor="store-prep">
            <input id="store-prep" name="prepTimeMinutes" type="number" min="0" className="input" defaultValue={values.prepTimeMinutes} />
          </Field>
        </div>
        <Field label="Dispatch coverage areas in Akwa Ibom" htmlFor="store-areas" hint="Comma separated, e.g. Uyo, Ikot Ekpene, Eket, Abak, Oron.">
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

export function VendorKycForm({ kyc }: { kyc: VendorKycValues }) {
  const [state, formAction] = useActionState<VendorState, FormData>(saveVendorKycAction, {});
  const [cacRegistered, setCacRegistered] = useState<"yes" | "no">(kyc.cacRegistered ? "yes" : "no");
  const [selectedFile, setSelectedFile] = useState<string>("");

  return (
    <form action={formAction} className="card card-pad space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-700" />
          <div>
            <h2 className="text-base font-semibold text-ink-900">Identity, Residence &amp; CAC Verification</h2>
            <p className="text-sm text-ink-500">
              NIN, Proof of Residence in Akwa Ibom, and optional CAC registration details on file with Ibom Vendors Hub.
            </p>
          </div>
        </div>
        <Badge
          tone={
            kyc.kycStatus === "verified"
              ? "success"
              : kyc.kycStatus === "rejected"
                ? "danger"
                : "info"
          }
        >
          KYC: {kyc.kycStatus}
        </Badge>
      </div>

      {kyc.kycNote ? <Alert tone="warning" title="Verification note">{kyc.kycNote}</Alert> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <input type="hidden" name="proofOfResidenceUrl" value={kyc.proofOfResidenceUrl} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="National Identification Number (NIN)"
          htmlFor="kyc-nin"
          error={state.fieldErrors?.nin}
          hint="11-digit NIN"
          required
        >
          <input
            id="kyc-nin"
            name="nin"
            defaultValue={kyc.nin}
            inputMode="numeric"
            pattern="\d{11}"
            maxLength={11}
            className="input font-mono tracking-wider"
            required
            placeholder="12345678901"
          />
        </Field>

        <Field
          label="Proof of residence type"
          htmlFor="kyc-proof-type"
          error={state.fieldErrors?.proofOfResidenceType}
          required
        >
          <select
            id="kyc-proof-type"
            name="proofOfResidenceType"
            className="select"
            defaultValue={kyc.proofOfResidenceType || "utility_bill"}
            required
          >
            {PROOF_OF_RESIDENCE_TYPES.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label={kyc.proofOfResidenceUrl ? "Replace proof of residence document (optional)" : "Upload proof of residence document"}
        htmlFor="kyc-proof-file"
        error={state.fieldErrors?.proofOfResidenceUrl}
        hint={selectedFile ? `Selected: ${selectedFile}` : "JPG, PNG, WEBP or PDF (max 6MB)"}
        required={!kyc.proofOfResidenceUrl}
      >
        <input
          id="kyc-proof-file"
          name="proofOfResidenceFile"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          required={!kyc.proofOfResidenceUrl}
          onChange={(e) => setSelectedFile(e.target.files?.[0]?.name ?? "")}
          className="input py-1.5 text-xs"
        />
      </Field>

      {kyc.proofOfResidenceUrl ? (
        <div className="flex items-center justify-between rounded-xl border border-ink-100 bg-ink-50/70 px-3.5 py-2 text-xs text-ink-700">
          <span className="flex items-center gap-1.5 font-medium">
            <FileCheck2 className="size-4 text-brand-700" /> Proof of residence document on file
          </span>
          <a
            href={kyc.proofOfResidenceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-brand-800 hover:underline"
          >
            View document <ExternalLink className="size-3.5" />
          </a>
        </div>
      ) : null}

      <div className="space-y-2.5">
        <p className="text-sm font-medium text-ink-800">Is your business registered with CAC?</p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <label
            className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-sm transition ${
              cacRegistered === "yes" ? "border-brand-600 bg-brand-50/40 ring-1 ring-brand-600" : "border-ink-200 bg-white"
            }`}
          >
            <input
              type="radio"
              name="cacRegistered"
              value="yes"
              checked={cacRegistered === "yes"}
              onChange={() => setCacRegistered("yes")}
              className="mt-0.5"
            />
            <div>
              <p className="font-semibold text-ink-900">Yes, registered with CAC</p>
              <p className="text-xs text-ink-500">Provide your RC, BN, or IT number</p>
            </div>
          </label>
          <label
            className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-sm transition ${
              cacRegistered === "no" ? "border-brand-600 bg-brand-50/40 ring-1 ring-brand-600" : "border-ink-200 bg-white"
            }`}
          >
            <input
              type="radio"
              name="cacRegistered"
              value="no"
              checked={cacRegistered === "no"}
              onChange={() => setCacRegistered("no")}
              className="mt-0.5"
            />
            <div>
              <p className="font-semibold text-ink-900">No, not registered yet</p>
              <p className="text-xs text-ink-500">Continue operating with NIN &amp; Proof of Residence</p>
            </div>
          </label>
        </div>
      </div>

      {cacRegistered === "yes" ? (
        <Field
          label="CAC registration number"
          htmlFor="kyc-cac-number"
          error={state.fieldErrors?.cacNumber}
          required
        >
          <input
            id="kyc-cac-number"
            name="cacNumber"
            defaultValue={kyc.cacNumber}
            className="input font-mono uppercase"
            required
            placeholder="e.g. BN-3482910 or RC-1928374"
          />
        </Field>
      ) : null}

      <div className="flex justify-end">
        <SubmitButton className="btn-primary" pendingLabel="Saving verification…">
          Save verification details
        </SubmitButton>
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
      <Field label="Reason for changing" htmlFor="subdomain-reason">
        <textarea id="subdomain-reason" name="reason" rows={2} className="textarea" placeholder="Rebrand, typo fix, etc." required />
      </Field>
      <SubdomainSubmit />
    </form>
  );
}

export function DeleteOwnStoreForm({ storeName, storeSlug }: { storeName: string; storeSlug: string }) {
  const [state, formAction] = useActionState<VendorState, FormData>(deleteOwnStoreAction, {});
  const [confirmText, setConfirmText] = useState("");
  const matches =
    confirmText.trim().toLowerCase() === storeName.trim().toLowerCase() ||
    confirmText.trim().toLowerCase() === storeSlug.trim().toLowerCase();

  return (
    <form action={formAction} className="card card-pad space-y-3 border-red-200 bg-red-50/30">
      <div>
        <h2 className="text-base font-semibold text-red-950">Delete storefront permanently</h2>
        <p className="mt-1 text-xs text-red-900/80">
          Deleting your store permanently removes <strong>{storeName}</strong>, all its products, uploaded images, and
          public storefront links from Ibom Vendors Hub immediately. This cannot be undone.
        </p>
      </div>
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <Field
        label={`Type "${storeName}" to confirm`}
        htmlFor="confirmStoreName"
        required
      >
        <input
          id="confirmStoreName"
          name="confirmStoreName"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="input bg-white"
          placeholder={storeName}
          required
        />
      </Field>
      <SubmitButton
        className={`btn-danger w-full ${!matches ? "opacity-60" : ""}`}
        pendingLabel="Deleting storefront…"
      >
        Delete storefront permanently
      </SubmitButton>
    </form>
  );
}
