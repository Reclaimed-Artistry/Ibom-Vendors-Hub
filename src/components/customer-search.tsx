"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, User } from "lucide-react";
import { filterCustomers, type SearchableCustomer } from "@/lib/customer-search";
import { cn } from "@/lib/utils";

export function CustomerSearch({
  customers,
  initialQuery,
}: {
  customers: SearchableCustomer[];
  initialQuery: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const suggestions = filterCustomers(customers, query);

  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function choose(customer: SearchableCustomer) {
    window.location.href = `/admin/customers/${customer.id}`;
  }

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
      choose(suggestions[highlighted]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <form method="get" action="/admin/customers" role="search" className="w-full sm:w-auto">
      <label htmlFor="customer-search" className="mb-1.5 block text-xs font-semibold text-ink-700">
        Search customers
      </label>
      <div ref={boxRef} className="relative w-full sm:w-[380px]">
        <div className="flex items-center gap-2">
          <input
            id="customer-search"
            type="search"
            name="q"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Start typing a name, email or phone…"
            maxLength={200}
            autoComplete="off"
            className="input min-w-0 flex-1"
          />
          <button type="submit" className="btn-secondary shrink-0 gap-1.5">
            <Search className="size-4" aria-hidden="true" />
            Search
          </button>
        </div>
        {open && query.trim() ? (
          <div className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-xl">
            {suggestions.length > 0 ? (
              <ul className="max-h-72 overflow-auto py-1">
                {suggestions.map((customer, index) => (
                  <li key={customer.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setHighlighted(index)}
                      onClick={() => choose(customer)}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2 text-left",
                        index === highlighted ? "bg-brand-50" : "bg-white",
                      )}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                        <User className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink-900">
                          {customer.full_name}
                        </span>
                        <span className="block truncate text-xs text-ink-500">
                          {customer.email}
                          {customer.phone ? ` · ${customer.phone}` : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 py-3 text-sm text-ink-500">
                No related customers yet — press Search to check the full directory.
              </p>
            )}
          </div>
        ) : null}
      </div>
      {initialQuery ? (
        <Link href="/admin/customers" className="mt-1.5 inline-block text-xs font-semibold text-brand-700 hover:underline">
          Clear search
        </Link>
      ) : null}
    </form>
  );
}
