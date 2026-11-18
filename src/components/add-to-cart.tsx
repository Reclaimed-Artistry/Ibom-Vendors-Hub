"use client";

import { farmMinimumQuantity } from "@/lib/agriculture";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { useCart } from "@/components/cart";
import { formatMoney, cn } from "@/lib/utils";
import type { Product, Store } from "@/lib/types";

export function AddToCart({
  product,
  store,
  currencySymbol = "₦",
}: {
  product: Product;
  store: Store;
  currencySymbol?: string;
}) {
  const { add } = useCart();
  const [variantId, setVariantId] = useState<string | null>(
    product.variants?.find((variant) => variant.is_available)?.id ?? null,
  );
  const minimumQuantity = farmMinimumQuantity(product.attributes);
  const [quantity, setQuantity] = useState(minimumQuantity);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [added, setAdded] = useState(false);

  const variant = product.variants?.find((item) => item.id === variantId) ?? null;
  const unitPrice = variant?.price ?? product.price;
  const addons = useMemo(
    () => (product.addons ?? []).filter((addon) => selectedAddons.includes(addon.name)),
    [product.addons, selectedAddons],
  );
  const total = (unitPrice + addons.reduce((sum, addon) => sum + addon.price, 0)) * quantity;

  const soldOut =
    product.track_stock && (variant ? variant.stock_quantity < minimumQuantity : product.stock_quantity < minimumQuantity);

  function handleAdd() {
    add({
      productId: product.id,
      storeId: store.id,
      storeSlug: store.slug,
      storeName: store.name,
      name: product.name,
      slug: product.slug,
      image: product.images?.[0]?.url,
      price: unitPrice,
      quantity,
      variantId: variant?.id ?? null,
      variantName: variant?.name ?? null,
      addons: addons.map((addon) => ({ name: addon.name, price: addon.price })),
      notes: notes || undefined,
      kind: product.kind,
      madeToOrder: product.made_to_order,
      storeDeliveryFee: store.delivery_fee,
      productDeliveryFee: product.delivery_fee,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  if (product.pricing_type === "quotation") {
    return (
      <div className="rounded-2xl border border-ink-100 bg-white p-5">
        <p className="text-sm text-ink-600">
          This service is priced after a quick review of your requirements. Send a request and {store.name} will respond
          with a written quotation.
        </p>
        <Link href={`/s/${store.slug}/quote/${product.slug}`} className="btn-primary mt-4 w-full">
          Request a quotation
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {product.variants?.length ? (
        <div>
          <p className="label">Choose an option</p>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={!option.is_available}
                onClick={() => setVariantId(option.id)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
                  variantId === option.id
                    ? "border-brand-700 bg-brand-50 text-brand-900"
                    : "border-ink-200 bg-white text-ink-600 hover:border-ink-300",
                  !option.is_available && "cursor-not-allowed line-through opacity-50",
                )}
              >
                {option.name}
                {option.price != null && option.price !== product.price ? (
                  <span className="ml-1 font-normal">· {formatMoney(option.price, product.currency, currencySymbol)}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {product.addons?.length ? (
        <div>
          <p className="label">Add extras</p>
          <div className="space-y-2">
            {product.addons.map((addon) => (
              <label key={addon.id} className="flex cursor-pointer items-center justify-between rounded-xl border border-ink-100 px-3 py-2 text-sm hover:border-ink-200">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={selectedAddons.includes(addon.name)}
                    onChange={(event) =>
                      setSelectedAddons((current) =>
                        event.target.checked ? [...current, addon.name] : current.filter((name) => name !== addon.name),
                      )
                    }
                  />
                  {addon.name}
                </span>
                <span className="font-medium text-ink-600">+{formatMoney(addon.price, product.currency, currencySymbol)}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {product.made_to_order ? (
        <div>
          <label className="label" htmlFor="cart-notes">
            Measurements, colour or custom instructions
          </label>
          <textarea
            id="cart-notes"
            className="textarea"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="e.g. Chest 42in, waist 34in, length 58in — navy blue lining"
          />
          <p className="hint">
            {product.production_days
              ? `Made to order — production takes about ${product.production_days} days after acceptance.`
              : "Made to order — the vendor will confirm the production timeline."}
          </p>
        </div>
      ) : null}

      {product.attributes?.produce_type ? <p className="text-xs text-ink-500">Price per {product.attributes.sale_unit} · {product.attributes.pack_size} · Minimum {minimumQuantity} unit(s)</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-xl border border-ink-200">
          <button type="button" className="p-2.5 text-ink-600" onClick={() => setQuantity((value) => Math.max(minimumQuantity, value - 1))} aria-label="Decrease quantity">
            <Minus className="size-4" />
          </button>
          <span className="w-8 text-center text-sm font-semibold">{quantity}</span>
          <button type="button" className="p-2.5 text-ink-600" onClick={() => setQuantity((value) => Math.min(99, value + 1))} aria-label="Increase quantity">
            <Plus className="size-4" />
          </button>
        </div>
        <button type="button" onClick={handleAdd} disabled={soldOut} className="btn-primary flex-1 sm:flex-none">
          {added ? <Check className="size-4" /> : <ShoppingBag className="size-4" />}
          {added ? "Added to cart" : soldOut ? "Out of stock" : `Add to cart · ${formatMoney(total, product.currency, currencySymbol)}`}
        </button>
      </div>

      {product.kind === "service" ? (
        <Link href={`/s/${store.slug}/book/${product.slug}`} className="btn-secondary w-full">
          Book an appointment instead
        </Link>
      ) : null}
    </div>
  );
}
