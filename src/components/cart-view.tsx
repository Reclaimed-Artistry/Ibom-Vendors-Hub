"use client";

import { ListingMedia } from "@/components/listing-media";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/components/cart";
import { formatMoney } from "@/lib/utils";
import { Card, EmptyState } from "@/components/ui";

export function CartView() {
  const { items, ready, subtotal, setQuantity, remove, clear } = useCart();

  if (!ready) return <p className="py-16 text-center text-sm text-ink-400">Loading your cart…</p>;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag className="size-10" />}
        title="Your cart is empty"
        description="Browse the marketplace and add items from any vendor — you can check out from multiple stores in one payment."
        action={<Link href="/browse" className="btn-primary">Start shopping</Link>}
      />
    );
  }

  const grouped = new Map<string, { storeName: string; storeSlug: string; deliveryFee: number; lines: typeof items }>();
  for (const item of items) {
    const current = grouped.get(item.storeSlug) ?? {
      storeName: item.storeName,
      storeSlug: item.storeSlug,
      deliveryFee: item.storeDeliveryFee ?? 0,
      lines: [] as typeof items,
    };
    current.lines.push(item);
    grouped.set(item.storeSlug, current);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_0.5fr]">
      <div className="space-y-4">
        {[...grouped.values()].map((group) => (
          <Card key={group.storeSlug} className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
              <Link href={`/s/${group.storeSlug}`} className="text-sm font-semibold text-brand-800 hover:text-brand-900">
                {group.storeName}
              </Link>
              <span className="text-xs text-ink-400">Delivery calculated at checkout</span>
            </div>
            <ul className="divide-y divide-ink-100">
              {group.lines.map((item) => {
                const index = items.indexOf(item);
                const unit = item.price + item.addons.reduce((sum, addon) => sum + addon.price, 0);
                return (
                  <li key={`${item.productId}-${item.variantId ?? ""}-${index}`} className="flex gap-4 px-5 py-4">
                    <ListingMedia autoPlayInView={false} src={item.image ?? "/images/seed/product-jollof.svg"} alt={item.name} className="size-20 rounded-xl border border-ink-100 object-cover" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/s/${item.storeSlug}/products/${item.slug}`} className="text-sm font-semibold text-ink-900 hover:text-brand-800">
                        {item.name}
                      </Link>
                      <p className="text-xs text-ink-500">{item.variantName ?? (item.kind === "service" ? "Service" : "Standard")}</p>
                      {item.addons.length ? <p className="text-xs text-ink-400">+ {item.addons.map((a) => `${a.name} (${formatMoney(a.price)})`).join(", ")}</p> : null}
                      {item.notes ? <p className="mt-1 line-clamp-2 text-xs italic text-ink-400">“{item.notes}”</p> : null}
                      <div className="mt-2 flex items-center gap-3">
                        <div className="flex items-center rounded-lg border border-ink-200">
                          <button type="button" className="p-1.5 text-ink-500" onClick={() => setQuantity(index, item.quantity - 1)} aria-label="Decrease">
                            <Minus className="size-3.5" />
                          </button>
                          <span className="w-7 text-center text-xs font-semibold">{item.quantity}</span>
                          <button type="button" className="p-1.5 text-ink-500" onClick={() => setQuantity(index, item.quantity + 1)} aria-label="Increase">
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                        <button type="button" onClick={() => remove(index)} className="inline-flex items-center gap-1 text-xs font-medium text-ink-400 hover:text-red-600">
                          <Trash2 className="size-3.5" /> Remove
                        </button>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-ink-900">{formatMoney(unit * item.quantity)}</p>
                      <p className="text-[11px] text-ink-400">{formatMoney(unit)} each</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
        <button type="button" onClick={clear} className="text-xs font-medium text-ink-400 hover:text-red-600">Clear cart</button>
      </div>

      <div>
        <Card className="card-pad sticky top-24">
          <h2 className="text-base font-semibold text-ink-900">Order summary</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between text-ink-600"><dt>Subtotal</dt><dd>{formatMoney(subtotal)}</dd></div>
            <div className="flex justify-between text-ink-600"><dt>Delivery</dt><dd className="text-xs">Calculated per vendor</dd></div>
          </dl>
          <div className="mt-3 flex justify-between border-t border-ink-100 pt-3 text-base font-bold">
            <span>Total</span>
            <span>{formatMoney(subtotal)}<span className="text-xs font-normal text-ink-400"> + delivery</span></span>
          </div>
          <Link href="/checkout" className="btn-primary mt-5 w-full">Continue to checkout</Link>
          <p className="mt-2 text-center text-[11px] text-ink-500">
            Sign-in required at checkout · Choose dispatch delivery or vendor shop pickup
          </p>
          <Link href="/browse" className="mt-1.5 block text-center text-xs font-medium text-ink-500 hover:text-ink-800">Keep shopping</Link>
        </Card>
      </div>
    </div>
  );
}
