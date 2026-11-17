"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { Lock, MapPin, ShieldCheck, Store, Truck, User } from "lucide-react";
import { useCart } from "@/components/cart";
import { submitCheckoutAction, type PublicState } from "@/app/actions/public";
import { AKWA_IBOM_LGAS } from "@/lib/akwa-ibom";
import { formatMoney } from "@/lib/utils";
import { Alert, Card, EmptyState, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

type Action = (prev: PublicState, formData: FormData) => Promise<PublicState>;

interface StoreFulfilmentInfo {
  slug: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  accepts_delivery: boolean;
  accepts_pickup: boolean;
  delivery_fee: number;
  delivery_areas: string | null;
  prep_time_minutes: number;
}

export function CheckoutForm({
  defaults,
  walletBalance = 0,
}: {
  defaults: {
    name?: string;
    email?: string;
    phone?: string;
    bioAddress?: string;
    address?: string;
    city?: string;
    state?: string;
  };
  walletBalance?: number;
}) {
  const { items, ready, subtotal } = useCart();
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "paystack">(
    walletBalance > 0 ? "wallet" : "paystack",
  );
  const [fulfilment, setFulfilment] = useState<"delivery" | "pickup">("delivery");
  const [bioAddress, setBioAddress] = useState(defaults.bioAddress ?? defaults.address ?? "");
  const [deliveryAddress, setDeliveryAddress] = useState(defaults.address ?? defaults.bioAddress ?? "");
  const [deliveryCity, setDeliveryCity] = useState(defaults.city || "Uyo");
  const [deliveryState, setDeliveryState] = useState(defaults.state || "Akwa Ibom");
  const [storeInfos, setStoreInfos] = useState<Record<string, StoreFulfilmentInfo>>({});
  const [pickupLocation, setPickupLocation] = useState("");
  const [state, action] = useActionState<PublicState, FormData>(submitCheckoutAction as Action, {});

  useEffect(() => {
    if (state?.redirectUrl) {
      window.location.href = state.redirectUrl;
    }
  }, [state]);

  const storeSlugsKey = useMemo(
    () => [...new Set(items.map((item) => item.storeSlug))].sort().join(","),
    [items],
  );

  useEffect(() => {
    if (!storeSlugsKey) return;
    let cancelled = false;
    fetch(`/api/checkout-stores?slugs=${encodeURIComponent(storeSlugsKey)}`)
      .then((res) => res.json())
      .then((data: { stores?: StoreFulfilmentInfo[] }) => {
        if (cancelled || !data.stores) return;
        const map: Record<string, StoreFulfilmentInfo> = {};
        for (const s of data.stores) map[s.slug] = s;
        setStoreInfos(map);

        const defaultPickup = data.stores
          .map((s) => `${s.name}: ${[s.address, s.city, s.state ?? "Akwa Ibom"].filter(Boolean).join(", ")}`)
          .join(" | ");
        setPickupLocation((prev) => prev || defaultPickup);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [storeSlugsKey]);

  if (!ready) return <p className="py-12 text-center text-sm text-ink-400">Loading checkout…</p>;

  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing to check out"
        description="Your cart is currently empty."
        action={<Link href="/browse" className="btn-primary">Browse marketplace</Link>}
      />
    );
  }

  const stores = new Map<string, { name: string; slug: string; fee: number }>();
  for (const item of items) {
    const liveInfo = storeInfos[item.storeSlug];
    if (!stores.has(item.storeSlug)) {
      stores.set(item.storeSlug, {
        name: liveInfo?.name ?? item.storeName,
        slug: item.storeSlug,
        fee: liveInfo ? Number(liveInfo.delivery_fee ?? 0) : item.storeDeliveryFee ?? 0,
      });
    }
  }
  const deliveryTotal =
    fulfilment === "delivery" ? [...stores.values()].reduce((s, v) => s + v.fee, 0) : 0;
  const total = subtotal + deliveryTotal;
  const walletCovers = walletBalance >= total;

  const payload = JSON.stringify(
    items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      addons: item.addons.map((a) => a.name),
      notes: item.notes ?? "",
    })),
  );

  const pickupLocationsList = [...stores.values()].map((s) => {
    const info = storeInfos[s.slug];
    return {
      slug: s.slug,
      name: s.name,
      fullAddress: info
        ? [info.address, info.city, info.state ?? "Akwa Ibom"].filter(Boolean).join(", ")
        : "Akwa Ibom State",
      phone: info?.phone ?? null,
      acceptsPickup: info?.accepts_pickup ?? true,
      acceptsDelivery: info?.accepts_delivery ?? true,
    };
  });

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
      <input type="hidden" name="items" value={payload} />
      <input type="hidden" name="paymentMethod" value={paymentMethod} />

      <div className="space-y-5">
        {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}

        {/* 1. Customer Bio Details */}
        <Card className="card-pad space-y-4">
          <div className="flex items-start gap-2.5">
            <User className="mt-0.5 size-5 shrink-0 text-brand-700" />
            <div>
              <h2 className="text-base font-semibold text-ink-900">1. Customer bio details</h2>
              <p className="text-xs text-ink-500">
                Your verified contact details for order confirmation, handover verification, and receipts.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="customerName" error={state?.fieldErrors?.customerName} required>
              <input id="customerName" name="customerName" defaultValue={defaults.name} className="input" required />
            </Field>
            <Field label="Phone number" htmlFor="customerPhone" error={state?.fieldErrors?.customerPhone} required>
              <input id="customerPhone" name="customerPhone" defaultValue={defaults.phone} className="input" required placeholder="0803 123 4567" />
            </Field>
          </div>

          <Field label="Email address" htmlFor="customerEmail" error={state?.fieldErrors?.customerEmail} required>
            <input id="customerEmail" name="customerEmail" type="email" defaultValue={defaults.email} className="input" required />
          </Field>

          <Field
            label="Your residential / contact address"
            htmlFor="bioAddress"
            error={state?.fieldErrors?.bioAddress}
            hint="Saved to your customer bio profile for order verification"
            required
          >
            <input
              id="bioAddress"
              name="bioAddress"
              value={bioAddress}
              onChange={(e) => setBioAddress(e.target.value)}
              className="input"
              required
              placeholder="House number, street name, town / estate"
            />
          </Field>
        </Card>

        {/* 2. Fulfilment Method: Use a Dispatch vs Pick up from Vendor's Location */}
        <Card className="card-pad space-y-4">
          <div>
            <h2 className="text-base font-semibold text-ink-900">2. How would you like to receive your order?</h2>
            <p className="text-xs text-ink-500">
              Choose whether to send a dispatch rider to your delivery location or pick up directly from the vendor&apos;s Akwa Ibom shop.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm transition ${
                fulfilment === "delivery"
                  ? "border-brand-600 bg-brand-50/50 ring-1 ring-brand-600"
                  : "border-ink-200 hover:border-ink-300"
              }`}
            >
              <input
                type="radio"
                name="fulfilmentType"
                value="delivery"
                checked={fulfilment === "delivery"}
                onChange={() => setFulfilment("delivery")}
                className="mt-1"
              />
              <div>
                <p className="flex items-center gap-1.5 font-semibold text-ink-900">
                  <Truck className="size-4 text-brand-700" /> Use a dispatch
                </p>
                <p className="mt-0.5 text-xs text-ink-500">
                  Delivered by dispatch rider to your specified location ({deliveryTotal ? formatMoney(deliveryTotal) : "Free"}).
                </p>
              </div>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm transition ${
                fulfilment === "pickup"
                  ? "border-brand-600 bg-brand-50/50 ring-1 ring-brand-600"
                  : "border-ink-200 hover:border-ink-300"
              }`}
            >
              <input
                type="radio"
                name="fulfilmentType"
                value="pickup"
                checked={fulfilment === "pickup"}
                onChange={() => setFulfilment("pickup")}
                className="mt-1"
              />
              <div>
                <p className="flex items-center gap-1.5 font-semibold text-ink-900">
                  <Store className="size-4 text-brand-700" /> Pick up from vendor&apos;s location
                </p>
                <p className="mt-0.5 text-xs text-ink-500">
                  Collect directly from the vendor&apos;s Akwa Ibom shop (Free · ₦0 dispatch fee).
                </p>
              </div>
            </label>
          </div>

          {/* 3. Delivery Location OR Vendor Pickup Location */}
          {fulfilment === "delivery" ? (
            <div className="space-y-4 rounded-xl border border-ink-100 bg-ink-50/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                  <MapPin className="size-4 text-brand-700" /> Dispatch delivery location
                </p>
                {bioAddress && deliveryAddress !== bioAddress ? (
                  <button
                    type="button"
                    onClick={() => setDeliveryAddress(bioAddress)}
                    className="text-xs font-semibold text-brand-800 hover:underline"
                  >
                    Use my residential address above
                  </button>
                ) : null}
              </div>

              <Field
                label="Delivery street address"
                htmlFor="address"
                error={state?.fieldErrors?.address}
                required
              >
                <input
                  id="address"
                  name="address"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="input bg-white"
                  required
                  placeholder="Exact street / building / compound for the dispatch rider"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Delivery location (Town / LGA)"
                  htmlFor="city"
                  error={state?.fieldErrors?.city}
                  required
                >
                  <input
                    id="city"
                    name="city"
                    list="akwa-ibom-lgas"
                    value={deliveryCity}
                    onChange={(e) => setDeliveryCity(e.target.value)}
                    className="input bg-white"
                    required
                    placeholder="e.g. Uyo, Eket, Ikot Ekpene"
                  />
                  <datalist id="akwa-ibom-lgas">
                    {AKWA_IBOM_LGAS.map((lga) => (
                      <option key={lga} value={lga} />
                    ))}
                  </datalist>
                </Field>
                <Field label="State" htmlFor="state" error={state?.fieldErrors?.state} required>
                  <input
                    id="state"
                    name="state"
                    value={deliveryState}
                    onChange={(e) => setDeliveryState(e.target.value)}
                    className="input bg-white"
                    required
                  />
                </Field>
              </div>

              <Field
                label="Dispatch rider notes / nearest landmark"
                htmlFor="deliveryNotes"
                hint="Gate colour, junction, or call-on-arrival note"
              >
                <input
                  id="deliveryNotes"
                  name="deliveryNotes"
                  className="input bg-white"
                  placeholder="e.g. Opposite Tropicana Mall gate, call on arrival"
                />
              </Field>
            </div>
          ) : (
            <div className="space-y-4 rounded-xl border border-brand-200 bg-brand-50/40 p-4">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                  <MapPin className="size-4 text-brand-700" /> Vendor pickup location(s) in Akwa Ibom
                </p>
                <p className="text-xs text-ink-600">
                  You will collect your order directly at the vendor address below once marked <strong>Ready for pickup</strong>.
                </p>
              </div>

              <ul className="space-y-2">
                {pickupLocationsList.map((loc) => (
                  <li key={loc.slug} className="rounded-xl border border-ink-200 bg-white p-3 text-xs">
                    <p className="font-semibold text-ink-900">{loc.name}</p>
                    <p className="mt-0.5 text-ink-700">{loc.fullAddress}</p>
                    {loc.phone ? <p className="mt-0.5 text-ink-500">Vendor phone: {loc.phone}</p> : null}
                    {!loc.acceptsPickup ? (
                      <p className="mt-1 font-semibold text-red-600">
                        Note: {loc.name} currently requires dispatch delivery.
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>

              <Field
                label="Confirmed pickup location / point"
                htmlFor="pickupLocation"
                error={state?.fieldErrors?.pickupLocation}
                hint="Confirm the vendor shop location (and any preferred pickup branch/note)"
                required
              >
                <input
                  id="pickupLocation"
                  name="pickupLocation"
                  value={pickupLocation}
                  onChange={(e) => setPickupLocation(e.target.value)}
                  className="input bg-white"
                  required
                  placeholder="Vendor pickup shop address in Akwa Ibom"
                />
              </Field>

              <Field label="Pickup note (optional)" htmlFor="deliveryNotes">
                <input
                  id="deliveryNotes"
                  name="deliveryNotes"
                  className="input bg-white"
                  placeholder="e.g. Coming by 4pm, or name of person picking up with your PIN"
                />
              </Field>
            </div>
          )}
        </Card>

        <Card className="card-pad space-y-4">
          <h2 className="text-base font-semibold">3. Order notes &amp; timing</h2>
          <Field label="Preferred date / time (optional)" htmlFor="scheduledFor">
            <input id="scheduledFor" name="scheduledFor" type="datetime-local" className="input" />
          </Field>
          <Field label="Notes for the vendor" htmlFor="customerNotes">
            <textarea id="customerNotes" name="customerNotes" rows={2} className="textarea" placeholder="Customisation notes, spice level, gift message…" />
          </Field>
        </Card>
      </div>

      <div>
        <Card className="card-pad sticky top-24 space-y-4">
          <h2 className="text-base font-semibold">Order summary</h2>
          <ul className="divide-y divide-ink-100 text-sm">
            {items.map((item, i) => {
              const unit = item.price + item.addons.reduce((s, a) => s + a.price, 0);
              return (
                <li key={i} className="flex justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-800">{item.quantity} × {item.name}</p>
                    <p className="text-xs text-ink-400">{item.storeName}</p>
                  </div>
                  <span className="font-semibold">{formatMoney(unit * item.quantity)}</span>
                </li>
              );
            })}
          </ul>
          <dl className="space-y-1.5 border-t border-ink-100 pt-3 text-sm">
            <div className="flex justify-between text-ink-600"><dt>Subtotal</dt><dd>{formatMoney(subtotal)}</dd></div>
            <div className="flex justify-between text-ink-600">
              <dt>{fulfilment === "delivery" ? `Dispatch (${stores.size} store${stores.size > 1 ? "s" : ""})` : "Vendor pickup"}</dt>
              <dd>{fulfilment === "delivery" ? formatMoney(deliveryTotal) : "Free"}</dd>
            </div>
          </dl>
          <div className="flex justify-between border-t border-ink-100 pt-3 text-base font-bold">
            <span>Total to pay</span>
            <span>{formatMoney(total)}</span>
          </div>

          {/* Payment method: wallet balance or PayStack */}
          {walletBalance > 0 ? (
            <div className="mt-4 space-y-2 rounded-xl border p-3">
              <p className="text-xs font-semibold text-ink-600 uppercase tracking-wide">Pay with</p>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border p-2.5 transition">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="wallet"
                  checked={paymentMethod === "wallet"}
                  onChange={() => setPaymentMethod("wallet")}
                  className="mt-0.5 shrink-0"
                  disabled={!walletCovers}
                />
                <div>
                  <p className="text-sm font-semibold text-ink-900">
                    Wallet balance
                  </p>
                  <p className="text-xs text-ink-500">
                    {walletCovers
                      ? `Covers full amount (₦${formatMoney(walletBalance)} available)`
                      : `Insufficient balance (₦${formatMoney(walletBalance)} available)`}
                  </p>
                </div>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border p-2.5 transition">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="paystack"
                  checked={paymentMethod === "paystack"}
                  onChange={() => setPaymentMethod("paystack")}
                  className="mt-0.5 shrink-0"
                />
                <div>
                  <p className="text-sm font-semibold text-ink-900">PayStack</p>
                  <p className="text-xs text-ink-500">Pay by card, bank transfer or USSD</p>
                </div>
              </label>
              {!walletCovers && paymentMethod === "wallet" ? (
                <p className="mt-1 text-xs text-red-600">
                  Wallet balance is too low for this order. Add funds or switch to PayStack.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-xs text-ink-500 text-center">
              Fund your wallet at <a href="/account/wallet" className="text-brand-700 font-semibold underline">Account &rarr; Wallet</a>, then pay with your balance here.
            </p>
          )}

          <SubmitButton className="w-full" pendingLabel="Preparing payment…">
            <Lock className="size-4" /> Pay {formatMoney(total)}
          </SubmitButton>
          <div className="rounded-xl bg-brand-50/70 p-3 text-[11px] text-brand-900">
            <p className="flex items-center gap-1.5 font-semibold">
              <ShieldCheck className="size-4 shrink-0 text-brand-700" /> Delivery-Protected Escrow
            </p>
            <p className="mt-1 text-brand-800/90">
              Vendor settlement stays held until you confirm receipt or share your secret <strong>6-digit Delivery PIN</strong> upon handover.
            </p>
          </div>
        </Card>
      </div>
    </form>
  );
}
