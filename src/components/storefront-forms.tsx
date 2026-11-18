"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, ClipboardCheck, MapPin, Wrench } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field } from "@/components/ui";
import { submitBookingAction, submitQuotationAction, type PublicState } from "@/app/actions/public";
import { getCategoryBookingProfile } from "@/lib/artisan-bookings";

export function BookingForm({
  storeId,
  productId,
  productName,
  price,
  duration,
  currencySymbol = "₦",
  categorySlug,
  defaultName,
  defaultEmail,
  defaultPhone,
}: {
  storeId: string;
  productId: string;
  productName: string;
  price: number;
  duration: number | null;
  currencySymbol?: string;
  categorySlug?: string | null;
  defaultName?: string;
  defaultEmail?: string;
  defaultPhone?: string;
}) {
  const [state, action] = useActionState<PublicState, FormData>(submitBookingAction, {});
  const [meetingPreference, setMeetingPreference] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const profile = getCategoryBookingProfile(categorySlug);

  return (
    <form action={action} className="space-y-4">
      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.message ? <Alert tone="success">{state.message}</Alert> : null}
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="productId" value={productId} />

      <div className="rounded-xl border border-ink-200 bg-ink-50 p-4">
        <p className="text-sm font-semibold text-ink-900">{productName}</p>
        <p className="mt-0.5 text-xs text-ink-600">
          {price > 0 ? `${currencySymbol}${price.toLocaleString()}` : "Quote / Inspection Rate"}
          {duration ? ` · Est. ${duration} mins` : ""}
        </p>
        <p className="mt-1 text-xs text-ink-500">{profile.paymentNote}</p>
      </div>

      {/* Stated trade-specific booking requirements */}
      <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-4">
        <div className="flex items-start gap-2.5">
          <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-brand-700" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-900">
              {profile.requirementsTitle}
            </p>
            <p className="mt-0.5 text-xs text-brand-800">
              Please review what is needed for this kind of service before submitting your booking:
            </p>
            <ul className="mt-2.5 space-y-1.5 text-xs leading-5 text-ink-800">
              {profile.requirements.map((req, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-brand-700" />
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your full name" htmlFor="customerName" error={state?.fieldErrors?.customerName} required>
          <input id="customerName" name="customerName" className="input" defaultValue={defaultName} required />
        </Field>
        <Field label="Phone / WhatsApp number" htmlFor="customerPhone" error={state?.fieldErrors?.customerPhone} required>
          <input
            id="customerPhone"
            name="customerPhone"
            className="input"
            defaultValue={defaultPhone}
            placeholder="0803 123 4567"
            required
          />
        </Field>
      </div>

      <Field label="Email address" htmlFor="customerEmail" error={state?.fieldErrors?.customerEmail} required>
        <input id="customerEmail" name="customerEmail" type="email" className="input" defaultValue={defaultEmail} required />
      </Field>

      <Field label="Where would you like the service?" htmlFor="meetingPreference" error={state?.fieldErrors?.meetingPreference} required>
        <select id="meetingPreference" name="meetingPreference" className="select" value={meetingPreference} onChange={(event) => setMeetingPreference(event.target.value)} required>
          <option value="">Choose a meeting option</option>
          <option value="customer_location">The professional should come to my home / office / venue</option>
          <option value="vendor_location">I will visit the professional&apos;s office / studio</option>
        </select>
      </Field>

      <Field
        label={meetingPreference === "customer_location" ? "Your service address, area and nearest landmark" : "Office / studio location or meeting instructions"}
        htmlFor="location"
        error={state?.fieldErrors?.location}
        required={meetingPreference === "customer_location"}
      >
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-3 top-3 size-4 text-ink-400" />
          <input
            id="location"
            name="location"
            className="input pl-9"
            placeholder={meetingPreference === "customer_location" ? "Street address, city / LGA and nearest landmark" : "Office / studio branch or instructions (optional)"}
            required={meetingPreference === "customer_location"}
          />
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type of visit / job" htmlFor="visitType" error={state?.fieldErrors?.visitType} required>
          <select id="visitType" name="visitType" className="select" required defaultValue={profile.visitTypes[0] ?? ""}>
            {profile.visitTypes.map((vt) => (
              <option key={vt} value={vt}>
                {vt}
              </option>
            ))}
          </select>
        </Field>

        {profile.materialsOptions && profile.materialsOptions.length > 0 ? (
          <Field label="Materials arrangement" htmlFor="materialsOption" error={state?.fieldErrors?.materialsOption} required>
            <select
              id="materialsOption"
              name="materialsOption"
              className="select"
              required
              defaultValue={profile.materialsOptions[0]}
            >
              {profile.materialsOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Preferred date" htmlFor="date" error={state?.fieldErrors?.date} required>
          <input id="date" name="date" type="date" min={today} className="input" required />
        </Field>
        <Field label="Preferred arrival / slot time" htmlFor="time" error={state?.fieldErrors?.time} required>
          <select id="time" name="time" className="select" required defaultValue="">
            <option value="" disabled>
              Select a time
            </option>
            {profile.timeSlots.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {profile.extraFields.length > 0 ? (
        <div className="space-y-4 rounded-xl border border-ink-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-600">
            <Wrench className="size-3.5 text-brand-700" />
            Service-specific technical details
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {profile.extraFields.map((field) => (
              <Field
                key={field.key}
                label={field.label}
                htmlFor={`extra_${field.key}`}
                error={state?.fieldErrors?.[`extra_${field.key}`]}
                required={field.required}
              >
                {field.type === "select" ? (
                  <select
                    id={`extra_${field.key}`}
                    name={`extra_${field.key}`}
                    className="select"
                    required={field.required}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Select option…
                    </option>
                    {(field.options ?? []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`extra_${field.key}`}
                    name={`extra_${field.key}`}
                    className="input"
                    placeholder={field.placeholder}
                    required={field.required}
                  />
                )}
              </Field>
            ))}
          </div>
        </div>
      ) : null}

      <Field label={profile.notesLabel} htmlFor="notes" error={state?.fieldErrors?.notes}>
        <textarea id="notes" name="notes" className="textarea" rows={3} placeholder={profile.notesPlaceholder} />
      </Field>

      <div className="rounded-xl border border-ink-200 bg-ink-50/70 p-3.5">
        <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-ink-800">
          <input
            type="checkbox"
            name="requirementsAccepted"
            required
            className="mt-0.5 size-4 shrink-0 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
          />
          <span>{profile.confirmLabel}</span>
        </label>
        {state?.fieldErrors?.requirementsAccepted ? (
          <p className="mt-1 text-xs font-medium text-red-600">{state.fieldErrors.requirementsAccepted}</p>
        ) : null}
      </div>

      <SubmitButton className="w-full" pendingLabel="Submitting booking…">
        {profile.ctaLabel}
      </SubmitButton>
      <p className="text-[11px] text-ink-400">
        Your contact, site address and service requirements are shared directly with the vendor to confirm your slot.
      </p>
    </form>
  );
}

export function QuoteForm({
  storeId,
  products,
  selectedProductId,
  categorySlug,
  defaultName,
  defaultEmail,
  defaultPhone,
}: {
  storeId: string;
  products: Array<{ id: string; name: string }>;
  selectedProductId?: string;
  categorySlug?: string | null;
  defaultName?: string;
  defaultEmail?: string;
  defaultPhone?: string;
}) {
  const [state, action] = useActionState<PublicState, FormData>(submitQuotationAction, {});
  const profile = getCategoryBookingProfile(categorySlug);

  return (
    <form action={action} className="space-y-4">
      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.message ? <Alert tone="success">{state.message}</Alert> : null}
      <input type="hidden" name="storeId" value={storeId} />

      {profile.isArtisan ? (
        <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-4">
          <div className="flex items-start gap-2.5">
            <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-brand-700" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-brand-900">
                What to include for an accurate {profile.requirementsTitle.replace(" Booking Requirements", "")} Quote / BOQ
              </p>
              <ul className="mt-2 space-y-1 text-xs leading-5 text-ink-800">
                {profile.requirements.map((req, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-brand-700" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {products.length ? (
        <Field label="Service" htmlFor="productId" hint="Optional — pick the service closest to your project">
          <select id="productId" name="productId" className="select" defaultValue={selectedProductId ?? ""}>
            <option value="">General project / quotation request</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="customerName" error={state?.fieldErrors?.customerName} required>
          <input id="customerName" name="customerName" className="input" defaultValue={defaultName} required />
        </Field>
        <Field label="Phone / WhatsApp number" htmlFor="customerPhone" error={state?.fieldErrors?.customerPhone} required>
          <input id="customerPhone" name="customerPhone" className="input" defaultValue={defaultPhone} required />
        </Field>
      </div>
      <Field label="Email address" htmlFor="customerEmail" error={state?.fieldErrors?.customerEmail} required>
        <input id="customerEmail" name="customerEmail" type="email" className="input" defaultValue={defaultEmail} required />
      </Field>
      <Field label="Project title / job summary" htmlFor="title" error={state?.fieldErrors?.title} required>
        <input
          id="title"
          name="title"
          className="input"
          placeholder={
            profile.isArtisan
              ? "e.g. Full POP ceiling & screeding for 3-bedroom flat at Shelter Afrique"
              : "e.g. Tailor a wedding agbada"
          }
          required
        />
      </Field>
      <Field
        label="Job location, measurements, materials & scope details"
        htmlFor="description"
        error={state?.fieldErrors?.description}
        required
      >
        <textarea
          id="description"
          name="description"
          className="textarea"
          rows={5}
          required
          placeholder={
            profile.isArtisan
              ? "Include exact job site address/LGA, room count or dimensions, whether you want Material + Labour or Labour Only, site power/water status, and target completion date."
              : "Measurements, materials, quantity, deadlines and any other requirement."
          }
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Estimated budget in ₦ (optional)" htmlFor="budget" error={state?.fieldErrors?.budget}>
          <input id="budget" name="budget" type="number" min="0" className="input" placeholder="Optional" />
        </Field>
        <Field label="Preferred inspection / start date (optional)" htmlFor="preferredDate">
          <input id="preferredDate" name="preferredDate" type="date" className="input" />
        </Field>
      </div>
      <SubmitButton className="w-full" pendingLabel="Sending request…">
        Send quotation / BOQ request
      </SubmitButton>
      <p className="text-[11px] text-ink-400">
        No payment is taken now. You will receive an itemised written quotation on Ibom Vendors Hub to accept or reject.
      </p>
    </form>
  );
}
