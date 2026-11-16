"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { formatMoney, cn } from "@/lib/utils";

export interface CartItem {
  productId: string;
  storeId: string;
  storeSlug: string;
  storeName: string;
  name: string;
  slug: string;
  image?: string;
  price: number;
  quantity: number;
  variantId?: string | null;
  variantName?: string | null;
  addons: Array<{ name: string; price: number }>;
  notes?: string;
  kind: "product" | "service";
  madeToOrder?: boolean;
  storeDeliveryFee?: number;
}

interface CartContextValue {
  items: CartItem[];
  ready: boolean;
  count: number;
  subtotal: number;
  add: (item: CartItem) => void;
  remove: (index: number) => void;
  setQuantity: (index: number, quantity: number) => void;
  clear: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "ivh_cart_v1";

function sameLine(a: CartItem, b: CartItem) {
  return (
    a.productId === b.productId &&
    (a.variantId ?? null) === (b.variantId ?? null) &&
    JSON.stringify(a.addons.map((x) => x.name).sort()) === JSON.stringify(b.addons.map((x) => x.name).sort()) &&
    (a.notes ?? "") === (b.notes ?? "")
  );
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {
      /* ignore corrupt cart */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage full/blocked */
    }
  }, [items, ready]);

  const add = useCallback((item: CartItem) => {
    setItems((current) => {
      const index = current.findIndex((line) => sameLine(line, item));
      if (index >= 0) {
        const next = [...current];
        next[index] = { ...next[index], quantity: next[index].quantity + item.quantity };
        return next;
      }
      return [...current, item];
    });
    setOpen(true);
  }, []);

  const remove = useCallback((index: number) => {
    setItems((current) => current.filter((_, i) => i !== index));
  }, []);

  const setQuantity = useCallback((index: number, quantity: number) => {
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, quantity: Math.max(1, Math.min(99, quantity)) } : item)),
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce(
      (sum, item) => sum + (item.price + item.addons.reduce((addonSum, addon) => addonSum + addon.price, 0)) * item.quantity,
      0,
    );
    return { items, ready, count, subtotal, add, remove, setQuantity, clear, open, setOpen };
  }, [items, ready, add, remove, setQuantity, clear, open]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}

export function CartButton({ className, base = "" }: { className?: string; base?: string }) {
  const { count, setOpen } = useCart();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn("relative inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3.5 py-2 text-sm font-semibold text-ink-800 hover:border-ink-300", className)}
      aria-label={`Open cart (${count} items)`}
    >
      <ShoppingBag className="size-4" />
      <span className="hidden sm:inline">Cart</span>
      {count > 0 ? (
        <span className="flex min-w-5 items-center justify-center rounded-full bg-brand-800 px-1.5 py-0.5 text-[11px] font-bold text-white">
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function CartDrawer({ base = "" }: { base?: string }) {
  const { items, open, setOpen, subtotal, remove, setQuantity } = useCart();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close cart" className="absolute inset-0 bg-ink-900/40" onClick={() => setOpen(false)} />
      <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <h2 className="text-base font-semibold">Your cart</h2>
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <p className="mt-10 text-center text-sm text-ink-500">Your cart is empty. Browse the marketplace to add items.</p>
          ) : (
            <ul className="space-y-4">
              {items.map((item, index) => (
                <li key={`${item.productId}-${item.variantId ?? ""}-${index}`} className="flex gap-3">
                  <img src={item.image ?? "/images/seed/product-jollof.svg"} alt={item.name} className="size-16 rounded-lg border border-ink-100 object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-900">{item.name}</p>
                    <p className="text-xs text-ink-500">{item.storeName}{item.variantName ? ` · ${item.variantName}` : ""}</p>
                    {item.addons.length ? <p className="text-xs text-ink-400">{item.addons.map((a) => a.name).join(", ")}</p> : null}
                    <div className="mt-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => setQuantity(index, item.quantity - 1)} className="rounded-md border border-ink-200 p-1 text-ink-600" aria-label="Decrease quantity">
                          <Minus className="size-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-semibold">{item.quantity}</span>
                        <button type="button" onClick={() => setQuantity(index, item.quantity + 1)} className="rounded-md border border-ink-200 p-1 text-ink-600" aria-label="Increase quantity">
                          <Plus className="size-3" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold">
                        {formatMoney((item.price + item.addons.reduce((sum, a) => sum + a.price, 0)) * item.quantity)}
                      </span>
                    </div>
                  </div>
                  <button type="button" onClick={() => remove(index)} className="self-start text-ink-400 hover:text-red-600" aria-label="Remove item">
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-ink-100 px-5 py-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-ink-500">Subtotal</span>
            <span className="text-base font-bold">{formatMoney(subtotal)}</span>
          </div>
          <Link href={`${base}/checkout`} className="btn-primary w-full" onClick={() => setOpen(false)}>
            Checkout
          </Link>
          <Link href={`${base}/cart`} onClick={() => setOpen(false)} className="mt-2 block text-center text-xs font-medium text-ink-500 hover:text-ink-800">
            View full cart
          </Link>
        </div>
      </div>
    </div>
  );
}
