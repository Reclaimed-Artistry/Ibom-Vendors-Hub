"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field } from "@/components/ui";
import { submitBookingAction, submitQuotationAction, type PublicState } from "@/app/actions/public";

export function BookingForm({
  storeId,
  productId,
  productName,
  price,
  duration,
  currencySymbol = "₦",
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
  defaultName?: string;
  defaultEmail?: string;
  defaultPhone?: string;
}) {
  const [state, action] = useActionState<PublicState, FormData>(submitBookingAction, {});
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="space-y-4">
      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.message ? <Alert tone="success">{state.message}</Alert> : null}
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="productId" value={productId} />
      <div className="rounded-xl bg-ink-50 p-4">
        <p className="text-sm font-semibold text-ink-900">{productName}</p>
        <p className="text-xs text-ink-500">
          {currencySymbol}
          {price.toLocaleString()} {duration ? `· ${duration} minutes` : ""} · pay at the studio
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="customerName" error={state?.fieldErrors?.customerName} required>
          <input id="customerName" name="customerName" className="input" defaultValue={defaultName} required />
        </Field>
        <Field label="Phone number" htmlFor="customerPhone" error={state?.fieldErrors?.customerPhone} required>
          <input id="customerPhone" name="customerPhone" className="input" defaultValue={defaultPhone} required />
        </Field>
      </div>
      <Field label="Email address" htmlFor="customerEmail" error={state?.fieldErrors?.customerEmail} required>
        <input id="customerEmail" name="customerEmail" type="email" className="input" defaultValue={defaultEmail} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Preferred date" htmlFor="date" error={state?.fieldErrors?.date} required>
          <input id="date" name="date" type="date" min={today} className="input" required />
        </Field>
        <Field label="Preferred time" htmlFor="time" error={state?.fieldErrors?.time} required>
          <select id="time" name="time" className="select" required defaultValue="">
            <option value="" disabled>Select a time</option>
            {["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"].map((slot) => (
              <option key={slot} value={slot}>{slot}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Anything we should know?" htmlFor="notes" error={state?.fieldErrors?.notes}>
        <textarea id="notes" name="notes" className="textarea" rows={3} placeholder="Allergies, preferences, arrival notes…" />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Booking…">Request appointment</SubmitButton>
      <p className="text-[11px] text-ink-400">The vendor confirms every appointment by email before it is final.</p>
    </form>
  );
}

export function QuoteForm({
  storeId,
  products,
  selectedProductId,
  defaultName,
  defaultEmail,
  defaultPhone,
}: {
  storeId: string;
  products: Array<{ id: string; name: string }>;
  selectedProductId?: string;
  defaultName?: string;
  defaultEmail?: string;
  defaultPhone?: string;
}) {
  const [state, action] = useActionState<PublicState, FormData>(submitQuotationAction, {});
  return (
    <form action={action} className="space-y-4">
      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.message ? <Alert tone="success">{state.message}</Alert> : null}
      <input type="hidden" name="storeId" value={storeId} />
      {products.length ? (
        <Field label="Service" htmlFor="productId" hint="Optional — pick the service closest to your request">
          <select id="productId" name="productId" className="select" defaultValue={selectedProductId ?? ""}>
            <option value="">General request</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
          </select>
        </Field>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="customerName" error={state?.fieldErrors?.customerName} required>
          <input id="customerName" name="customerName" className="input" defaultValue={defaultName} required />
        </Field>
        <Field label="Phone number" htmlFor="customerPhone" error={state?.fieldErrors?.customerPhone} required>
          <input id="customerPhone" name="customerPhone" className="input" defaultValue={defaultPhone} required />
        </Field>
      </div>
      <Field label="Email address" htmlFor="customerEmail" error={state?.fieldErrors?.customerEmail} required>
        <input id="customerEmail" name="customerEmail" type="email" className="input" defaultValue={defaultEmail} required />
      </Field>
      <Field label="What do you need?" htmlFor="title" error={state?.fieldErrors?.title} required>
        <input id="title" name="title" className="input" placeholder="e.g. Tailor a wedding agbada" required />
      </Field>
      <Field label="Details" htmlFor="description" error={state?.fieldErrors?.description} required>
        <textarea id="description" name="description" className="textarea" rows={5} required placeholder="Measurements, materials, quantity, deadlines and any other requirement." />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Budget (optional)" htmlFor="budget" error={state?.fieldErrors?.budget}>
          <input id="budget" name="budget" type="number" min="0" className="input" placeholder="Optional" />
        </Field>
        <Field label="Preferred date (optional)" htmlFor="preferredDate">
          <input id="preferredDate" name="preferredDate" type="date" className="input" />
        </Field>
      </div>
      <SubmitButton className="w-full" pendingLabel="Sending request…">Send quotation request</SubmitButton>
      <p className="text-[11px] text-ink-400">No payment is taken now. You will receive a written quotation to accept or reject.</p>
    </form>
  );
}
