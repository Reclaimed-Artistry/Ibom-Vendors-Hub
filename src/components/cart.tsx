"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  productDeliveryFee?: number | null;
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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sameLine(a: CartItem, b: CartItem) {
  return (
    a.productId === b.productId &&
    (a.variantId ?? null) === (b.variantId ?? null) &&
    JSON.stringify(a.addons.map((x) => x.name).sort()) === JSON.stringify(b.addons.map((x) => x.name).sort()) &&
    (a.notes ?? "") === (b.notes ?? "")
  );
}

async function filterLiveCartItems(candidates: CartItem[]): Promise<CartItem[]> {
  const wellFormed = candidates.filter((item) => item && typeof item.productId === "string" && UUID_RE.test(item.productId));
  if (wellFormed.length === 0) return [];
  const ids = [...new Set(wellFormed.map((item) => item.productId))];
  try {
    const res = await fetch(`/api/checkout-stores?productIds=${encodeURIComponent(ids.join(","))}`, {
      cache: "no-store",
    });
    if (!res.ok) return wellFormed;
    const data = (await res.json()) as { validProductIds?: string[] };
    if (!Array.isArray(data.validProductIds)) return wellFormed;
    const validSet = new Set(data.validProductIds);
    return wellFormed.filter((item) => validSet.has(item.productId));
  } catch {
    return wellFormed;
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const itemsRef = useRef<CartItem[]>([]);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Hydrate from localStorage ONLY after verifying against live database products,
  // so deleted products never appear in the cart badge, drawer, or /cart page.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let parsed: CartItem[] = [];
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const json = JSON.parse(raw);
          if (Array.isArray(json)) parsed = json as CartItem[];
        }
      } catch {
        parsed = [];
      }

      if (parsed.length === 0) {
        if (!cancelled) {
          setItems([]);
          setReady(true);
        }
        return;
      }

      const verified = await filterLiveCartItems(parsed);
      if (!cancelled) {
        setItems(verified);
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(verified));
        } catch {
          /* ignore storage restrictions */
        }
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage full/blocked */
    }
  }, [items, ready]);

  // Re-verify cart items on navigation, drawer open, tab focus/visibility, and BFCache restore
  const itemKey = useMemo(() => items.map((i) => i.productId).sort().join(","), [items]);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    async function syncNow() {
      const current = itemsRef.current;
      if (current.length === 0) return;
      const verified = await filterLiveCartItems(current);
      if (cancelled) return;
      setItems((prev) => {
        const validIds = new Set(verified.map((v) => v.productId));
        const filtered = prev.filter((item) => UUID_RE.test(item.productId) && validIds.has(item.productId));
        return filtered.length === prev.length ? prev : filtered;
      });
    }

    syncNow();

    const onFocus = () => {
      syncNow();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        syncNow();
      }
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        router.refresh();
      }
      syncNow();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [ready, open, pathname, itemKey, router]);

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

export function CartButton({ className }: { className?: string; base?: string }) {
  const { count, setOpen } = useCart();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        "relative inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-2.5 py-2 text-sm font-semibold text-ink-800 hover:border-ink-300 sm:gap-2 sm:px-3.5",
        className,
      )}
      aria-label={`Open cart (${count} items)`}
    >
      <ShoppingBag className="size-4 shrink-0" />
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
  const { items, count, open, setOpen, subtotal, remove, setQuantity } = useCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, setOpen]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] isolate flex items-start justify-end p-3 pt-20 sm:p-5 sm:pt-20"
      role="dialog"
      aria-modal="true"
      aria-label="Shopping cart"
    >
      <button
        type="button"
        aria-label="Close cart"
        className="fixed inset-0 bg-ink-900/30 backdrop-blur-[3px]"
        onClick={() => setOpen(false)}
      />
      <div className="relative z-10 flex max-h-[calc(100dvh-6rem)] w-full max-w-[360px] flex-col overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_24px_80px_-16px_rgba(15,23,42,0.35)]">
        <div className="flex items-center justify-between shrink-0 border-b border-ink-100 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-700"><ShoppingBag className="size-4" /></span>
            <div>
              <h2 className="text-sm font-bold text-ink-900">Your cart <span className="ml-1 rounded-full bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-500">{count}</span></h2>
              <p className="mt-0.5 text-[11px] text-ink-400">A little closer to something good.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid size-9 place-items-center rounded-full text-ink-400 transition hover:bg-ink-100 hover:text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-1">
          {items.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <ShoppingBag className="mx-auto mb-3 size-8 text-brand-300" />
              <p className="text-sm font-semibold text-ink-800">Your bag is waiting</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">Found something you love? Add it here.</p>
              <button type="button" onClick={() => setOpen(false)} className="mt-4 text-xs font-semibold text-brand-700 hover:underline">Keep browsing</button>
            </div>
          ) : (
            <ul className="divide-y divide-ink-100">
              {items.map((item, index) => (
                <li key={`${item.productId}-${item.variantId ?? ""}-${index}`} className="flex gap-2.5 py-3">
                  <img
                    src={item.image ?? "/images/seed/product-jollof.svg"}
                    alt={item.name}
                    className="size-12 shrink-0 rounded-xl border border-ink-100 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-900">{item.name}</p>
                    <p className="truncate text-xs text-ink-500">
                      {item.storeName}
                      {item.variantName ? ` · ${item.variantName}` : ""}
                    </p>
                    {item.addons.length ? (
                      <p className="truncate text-xs text-ink-400">{item.addons.map((a) => a.name).join(", ")}</p>
                    ) : null}
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-0.5 rounded-full bg-ink-50 p-0.5 ring-1 ring-ink-100">
                        <button
                          type="button"
                          onClick={() => setQuantity(index, item.quantity - 1)}
                          className="grid size-7 place-items-center rounded-full text-ink-600 transition hover:bg-white hover:shadow-sm"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-semibold">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => setQuantity(index, item.quantity + 1)}
                          className="grid size-7 place-items-center rounded-full text-ink-600 transition hover:bg-white hover:shadow-sm"
                          aria-label="Increase quantity"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>
                      <span className="text-xs font-bold tabular-nums text-ink-900">
                        {formatMoney((item.price + item.addons.reduce((sum, a) => sum + a.price, 0)) * item.quantity)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="-mr-1 grid size-7 shrink-0 place-items-center self-start rounded-full text-ink-300 transition hover:bg-red-50 hover:text-red-600"
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {items.length > 0 ? <div className="shrink-0 border-t border-ink-100 bg-ink-50/70 px-4 py-3">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-ink-500">Subtotal</span>
            <span className="text-base font-bold">{formatMoney(subtotal)}</span>
          </div>
          <p className="mb-3 text-[10px] text-ink-400">Delivery calculated at checkout</p>
          <Link href={`${base}/checkout`} className="btn-primary w-full rounded-xl !py-2.5 !text-sm" onClick={() => setOpen(false)}>
            Continue to checkout
          </Link>
          <Link
            href={`${base}/cart`}
            onClick={() => setOpen(false)}
            className="mt-2 block text-center text-xs font-medium text-ink-500 hover:text-ink-800"
          >
            View full cart
          </Link>
        </div> : null}
      </div>
    </div>,
    document.body,
  );
}
