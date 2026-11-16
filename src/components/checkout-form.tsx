"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, LockKeyhole } from "lucide-react";
import { useCart } from "@/components/cart";
import { submitCheckoutAction, type PublicState } from "@/app/actions/public";
import { Alert, Field } from "@/components/ui";
import { formatMoney, todayIso } from "@/lib/utils";

export function CheckoutForm({
  defaultName,
  defaultEmail,
  defaultPhone,
  defaultAddress,
  defaultCity,
  defaultState,
}: {
  defaultName?: string;
  defaultEmail?: string;
  defaultPhone?: string;
  defaultAddress?: string;
  defaultCity?: string;
  defaultState?: string;
}) {
  const { items, subtotal, ready } = useCart();
  const [state, action] = useActionState<PublicState, FormData>(submitCheckoutAction, {});
  const [fulfilment, setFulfilment] = useState("delivery");
  const [scheduled, setScheduled] = useState("");

  useEffect(() => {
    if (state?.redirectUrl) window.location.assign(state.redirectUrl);
  }, [state?.redirectUrl]);

  if (!ready) return <p className="py-16 text-center text-sm text-ink-400">Loading…</p>;
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-200 bg-white p-10 text-center">
        <p className="text-sm text-ink-500">Your cart is empty.</p>
        <Link href="/browse" className="btn-primary mt-4">Browse the marketplace</Link>
      </div>
    );
  }

  const payload = items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId ?? null,
    quantity: item.quantity,
    addons: item.addons.map((addon) => addon.name),
    notes: item.notes ?? "",
  }));

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
      {state?.error ? <div className="lg:col-span-2"><Alert tone="danger">{state.error}</Alert></div> : null}
      <input type="hidden" name="items" value={JSON.stringify(payload)} />
      <div className="space-y-5">
        <div className="card card-pad">
          <h2 className="text-base font-semibold text-ink-900">Contact details</h2>
          <p className="mt-0.5 text-xs text-ink-500">Your receipt and delivery updates go here.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="customerName" error={state?.fieldErrors?.customerName} required>
              <input id="customerName" name="customerName" className="input" defaultValue={defaultName} required />
            </Field>
            <Field label="Phone number" htmlFor="customerPhone" error={state?.fieldErrors?.customerPhone} required>
              <input id="customerPhone" name="customerPhone" className="input" defaultValue={defaultPhone} required />
            </Field>
          </div>
          <Field label="Email address" htmlFor="customerEmail" error={state?.fieldErrors?.customerEmail} required className="mt-4">
            <input id="customerEmail" name="customerEmail" type="email" className="input" defaultValue={defaultEmail} required />
          </Field>
        </div>

        <div className="card card-pad">
          <h2 className="text-base font-semibold text-ink-900">Fulfilment</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              { key: "delivery", title: "Deliver to me", note: "Vendor delivers to your address" },
              { key: "pickup", title: "I'll pick it up", note: "Collect from the vendor" },
            ].map((option) => (
              <label
                key={option.key}
                className={`cursor-pointer rounded-xl border px-4 py-3 text-sm transition-colors ${
                  fulfilment === option.key ? "border-brand-600 bg-brand-50" : "border-ink-200 bg-white hover:border-ink-300"
                }`}
              >
                <span className="flex items-center gap-2 font-semibold text-ink-900">
                  <input type="radio" name="fulfilmentType" value={option.key} checked={fulfilment === option.key} onChange={() => setFulfilment(option.key)} />
                  {option.title}
                </span>
                <span className="mt-1 block pl-6 text-xs text-ink-500">{option.note}</span>
              </label>
            ))}
          </div>

          {fulfilment === "delivery" ? (
            <div className="mt-4 space-y-4">
              <Field label="Delivery address" htmlFor="address" error={state?.fieldErrors?.address} required>
                <input id="address" name="address" className="input" defaultValue={defaultAddress} placeholder="House number, street, area" required />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="City" htmlFor="city" error={state?.fieldErrors?.city} required>
                  <input id="city" name="city" className="input" defaultValue={defaultCity} required />
                </Field>
                <Field label="State" htmlFor="state" error={state?.fieldErrors?.state} required>
                  <input id="state" name="state" className="input" defaultValue={defaultState ?? "Akwa Ibom"} required />
                </Field>
              </div>
              <Field label="Delivery notes" htmlFor="deliveryNotes" error={state?.fieldErrors?.deliveryNotes}>
                <input id="deliveryNotes" name="deliveryNotes" className="input" placeholder="Landmark, gate colour, best time…" />
              </Field>
            </div>
          ) : (
            <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">
              Pickup orders are collected directly from the vendor. You will receive their address after acceptance.
            </p>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Schedule for later (optional)" htmlFor="scheduledFor" error={state?.fieldErrors?.scheduledFor}>
              <input
                id="scheduledFor"
                name="scheduledFor"
                type="datetime-local"
                min={todayIso()}
                className="input"
                value={scheduled}
                onChange={(event) => setScheduled(event.target.value)}
              />
            </Field>
            <Field label="Order notes (optional)" htmlFor="customerNotes" error={state?.fieldErrors?.customerNotes}>
              <input id="customerNotes" name="customerNotes" className="input" placeholder="Anything the vendor should know" />
            </Field>
          </div>
        </div>
      </div>

      <div>
        <div className="card card-pad sticky top-24">
          <h2 className="text-base font-semibold text-ink-900">Your order</h2>
          <ul className="mt-3 max-h-64 space-y-3 overflow-y-auto">
            {items.map((item, index) => (
              <li key={index} className="flex justify-between gap-2 text-sm">
                <div>
                  <p className="font-medium text-ink-800">{item.name} <span className="text-ink-400">× {item.quantity}</span></p>
                  <p className="text-[11px] text-ink-400">{item.storeName}{item.variantName ? ` · ${item.variantName}` : ""}</p>
                </div>
                <span className="whitespace-nowrap text-sm font-semibold">
                  {formatMoney((item.price + item.addons.reduce((sum, addon) => sum + addon.price, 0)) * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-2 border-t border-ink-100 pt-3 text-sm">
            <div className="flex justify-between text-ink-600"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
            <div className="flex justify-between text-ink-600"><span>Delivery</span><span className="text-xs">Added per vendor</span></div>
            <div className="flex justify-between text-base font-bold text-ink-900"><span>Total</span><span>≥ {formatMoney(subtotal)}</span></div>
          </div>
          <button type="submit" className="btn-primary mt-4 w-full">
            <LockKeyhole className="size-4" /> Pay securely
          </button>
          <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-ink-400">
            <Loader2 className="size-3" /> Verified server-side before vendors accept orders
          </p>
        </div>
      </div>
    </form>
  );
}
