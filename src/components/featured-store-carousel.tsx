"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Pause, Play, Star } from "lucide-react";
import { StoreImage } from "@/components/store-image";

export interface FeaturedStoreSlide {
  id: string;
  slug: string;
  name: string;
  cover_url: string | null;
  logo_url: string | null;
  category_name: string | null;
  city: string | null;
  state: string | null;
  summary: string;
  rating_avg: number;
  product_count: number;
}

export function FeaturedStoreCarousel({ stores, label = "Featured stores" }: { stores: FeaturedStoreSlide[]; label?: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(media.matches);
    const updateVisibility = () => setHidden(document.hidden);
    updateMotion();
    updateVisibility();
    media.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      media.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);
  useEffect(() => {
    if (stores.length < 2 || paused || hovered || focused || hidden || reducedMotion) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % stores.length), 2000);
    return () => window.clearInterval(timer);
  }, [stores.length, paused, hovered, focused, hidden, reducedMotion]);

  if (!stores.length) return null;
  const active = index % stores.length;
  const move = (direction: number) => setIndex((current) => (current + direction + stores.length) % stores.length);
  return (
    <section
      aria-label={label}
      aria-roledescription="carousel"
      className="min-w-0"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}
    >
      <div className="overflow-hidden rounded-2xl">
        <div className="flex transition-transform duration-500 ease-out motion-reduce:transition-none" style={{ transform: `translateX(-${active * 100}%)` }}>
          {stores.map((store, position) => (
            <div key={store.id} role="group" aria-roledescription="slide" aria-label={`${position + 1} of ${stores.length}: ${store.name}`} aria-hidden={position !== active} inert={position !== active} className="w-full min-w-0 shrink-0">
              <Link href={`/s/${store.slug}`} tabIndex={position === active ? 0 : -1} className="card flex h-80 min-w-0 flex-col overflow-hidden">
                <div className="relative h-28 shrink-0 overflow-hidden">
                  <StoreImage kind="cover" src={store.cover_url} className="size-full object-cover" />
                  <span title={store.category_name ?? undefined} className="absolute left-3 right-3 top-3 w-fit max-w-[calc(100%-1.5rem)] truncate rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-ink-700">{store.category_name || "Independent vendor"}</span>
                </div>
                <div className="flex min-h-0 flex-1 flex-col p-4">
                  <div className="flex items-start gap-3">
                    <StoreImage kind="logo" src={store.logo_url} className="size-11 shrink-0 rounded-xl border border-ink-100 bg-white object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-900">{store.name}</p>
                      <p className="truncate text-xs text-ink-400">{[store.city, store.state].filter(Boolean).join(", ")}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-gold-600"><Star className="size-3.5 fill-current" />{store.rating_avg || "New"}</span>
                  </div>
                  <p className="mt-3 h-12 shrink-0 line-clamp-2 text-sm leading-6 text-ink-500">{store.summary}</p>
                  <p className="mt-auto pt-3 text-xs font-medium text-brand-800">{store.product_count} listings · view storefront →</p>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
      {stores.length > 1 ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-white p-2 text-ink-700">
          <button type="button" aria-label="Previous store" onClick={() => move(-1)} className="rounded-lg p-2 hover:bg-ink-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"><ChevronLeft className="size-4" /></button>
          <span className="text-xs font-medium" aria-live={paused || focused || reducedMotion ? "polite" : "off"}>{active + 1} / {stores.length}</span>
          <button type="button" aria-label={paused ? "Resume carousel" : "Pause carousel"} aria-pressed={paused} onClick={() => setPaused((value) => !value)} className="inline-flex items-center gap-1.5 rounded-lg p-2 text-xs hover:bg-ink-100">{paused ? <Play className="size-4" /> : <Pause className="size-4" />}{paused ? "Play" : "Pause"}</button>
          <button type="button" aria-label="Next store" onClick={() => move(1)} className="rounded-lg p-2 hover:bg-ink-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"><ChevronRight className="size-4" /></button>
        </div>
      ) : null}
    </section>
  );
}
