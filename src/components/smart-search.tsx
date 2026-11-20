"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, Package, Store, LayoutGrid, User } from "lucide-react";
import { filterByText } from "@/lib/customer-search";
import { cn } from "@/lib/utils";

export type SuggestionItem = {
  title: string;
  subtitle?: string;
  href: string;
  searchText: string;
  icon?: "product" | "store" | "category" | "user" | "record";
};

type MarketplaceSuggestion = {
  products: { name: string; slug: string; price: number | null; store_name: string; store_slug: string; kind: string }[];
  stores: { name: string; slug: string; city: string | null; category_name: string | null }[];
  categories: { name: string; slug: string }[];
};

const ICONS = {
  product: Package,
  store: Store,
  category: LayoutGrid,
  user: User,
  record: Package,
};

/**
 * Smart search box used across the site. As the user types, related results
 * appear instantly — either from a local list (admin/vendor pages) or from
 * the marketplace suggestions API. Pressing Search still submits the form.
 */
export function SmartSearch({
  action,
  placeholder = "Search…",
  initialQuery = "",
  items,
  marketplace = false,
  variant = "default",
  bare = false,
  hiddenFields,
  className,
}: {
  action: string;
  placeholder?: string;
  initialQuery?: string;
  items?: SuggestionItem[];
  marketplace?: boolean;
  variant?: "default" | "gold";
  hiddenFields?: Record<string, string>;
  /** Render only the input + suggestions (for embedding in an existing filter form). */
  bare?: boolean;
  className?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [remote, setRemote] = useState<SuggestionItem[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  const suggestions = marketplace
    ? remote
    : filterByText(items ?? [], query, (item) => item.searchText);

  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  useEffect(() => {
    if (!marketplace) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setRemote([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search-suggestions?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data: MarketplaceSuggestion) => {
          setRemote([
            ...data.products.map((p) => ({
              title: p.name,
              subtitle: `${p.store_name}${p.price ? ` · ₦${Number(p.price).toLocaleString()}` : ""}`,
              href: `/s/${p.store_slug}/products/${p.slug}`,
              searchText: p.name,
              icon: "product" as const,
            })),
            ...data.stores.map((s) => ({
              title: s.name,
              subtitle: [s.category_name, s.city].filter(Boolean).join(" · ") || "Store",
              href: `/s/${s.slug}`,
              searchText: s.name,
              icon: "store" as const,
            })),
            ...data.categories.map((c) => ({
              title: c.name,
              subtitle: "Category",
              href: `/browse?category=${c.slug}`,
              searchText: c.name,
              icon: "category" as const,
            })),
          ]);
        })
        .catch(() => {});
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, marketplace]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown" && suggestions.length > 0) {
      event.preventDefault();
      setOpen(true);
      setHighlighted((h) => (h + 1) % suggestions.length);
    } else if (event.key === "ArrowUp" && suggestions.length > 0) {
      event.preventDefault();
      setHighlighted((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" && open && suggestions[highlighted]) {
      event.preventDefault();
      window.location.href = suggestions[highlighted].href;
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const dark = variant === "gold";

  const box = (
    <div ref={boxRef} className="relative w-full">
      <div className={cn("flex items-center gap-2", dark && "flex-col sm:flex-row")}>
        <div className="relative flex-1">
          <Search
            className={cn(
              "pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-ink-400",
              dark ? "left-4 size-5" : "left-3.5",
            )}
            aria-hidden="true"
          />
          <input
            type="search"
            name="q"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            maxLength={200}
            autoComplete="off"
            aria-label={placeholder}
            className={
              dark
                ? "w-full rounded-2xl border border-white/15 bg-white py-4 pl-12 pr-4 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-4 focus:ring-brand-500/30"
                : "input pl-10"
            }
          />
        </div>
        {bare ? null : (
          <button type="submit" className={dark ? "btn-gold rounded-2xl px-7 py-4 text-sm" : "btn-primary shrink-0"}>
            Search
          </button>
        )}
      </div>
      {open && query.trim().length >= (marketplace ? 2 : 1) ? (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-ink-200 bg-white text-left shadow-xl">
          {suggestions.length > 0 ? (
            <ul className="max-h-80 overflow-auto py-1">
              {suggestions.map((item, index) => {
                const Icon = ICONS[item.icon ?? "record"];
                return (
                  <li key={`${item.href}-${index}`}>
                    <button
                      type="button"
                      onMouseEnter={() => setHighlighted(index)}
                      onClick={() => {
                        window.location.href = item.href;
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2 text-left",
                        index === highlighted ? "bg-brand-50" : "bg-white",
                      )}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink-900">{item.title}</span>
                        {item.subtitle ? (
                          <span className="block truncate text-xs text-ink-500">{item.subtitle}</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-3 py-3 text-sm text-ink-500">
              No related matches yet — press Search to check everything.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );

  if (bare) return box;

  return (
    <form method="get" action={action} role="search" className={cn("w-full", className)}>
      {hiddenFields
        ? Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))
        : null}
      {box}
      {initialQuery ? (
        <Link href={action} className="mt-1.5 inline-block text-xs font-semibold text-brand-700 hover:underline">
          Clear search
        </Link>
      ) : null}
    </form>
  );
}
