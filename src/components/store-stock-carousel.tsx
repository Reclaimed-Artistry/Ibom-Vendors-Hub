"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { ListingMedia } from "@/components/listing-media";

export interface StockSlide {
  id: string;
  href: string;
  name: string;
  image: string | null;
  mime_type?: string | null;
  summary: string;
  price: string;
  service: boolean;
}

export function StoreStockCarousel({ items }: { items: StockSlide[] }) {
  const stores = items;
  const label = "Explore this vendor's products and services";
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
          {items.map((item, position) => (
            <div key={item.id} role="group" aria-roledescription="slide" aria-label={`${position + 1} of ${items.length}: ${item.name}`} aria-hidden={position !== active} inert={position !== active} className="w-full min-w-0 shrink-0">
              <Link href={item.href} tabIndex={position === active ? 0 : -1} className="card grid h-[34rem] grid-rows-[13rem_1fr] overflow-hidden sm:h-80 sm:grid-cols-2 sm:grid-rows-1">
                <ListingMedia autoPlayInView={position === active} src={item.image || "/brand/store-cover-placeholder.svg"} mimeType={item.mime_type} alt={item.name} className="h-52 w-full object-cover sm:h-80" />
                <div className="flex min-h-0 min-w-0 flex-col justify-center p-5 sm:p-8">
                  <span className="text-xs font-semibold uppercase tracking-wider text-brand-700">{item.service ? "Book a service" : "Available stock"}</span>
                  <h3 className="mt-2 line-clamp-2 font-display text-2xl text-ink-900">{item.name}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-500">{item.summary}</p>
                  <p className="mt-4 text-xl font-bold text-ink-900">{item.price}</p>
                  <span className="mt-4 w-fit rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white">{item.service ? "Book now →" : "View item →"}</span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
      {stores.length > 1 ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-white p-2 text-ink-700">
          <button type="button" aria-label="Previous item" onClick={() => move(-1)} className="rounded-lg p-2 hover:bg-ink-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"><ChevronLeft className="size-4" /></button>
          <span className="text-xs font-medium" aria-live={paused || focused || reducedMotion ? "polite" : "off"}>{active + 1} / {stores.length}</span>
          <button type="button" aria-label={paused ? "Resume carousel" : "Pause carousel"} aria-pressed={paused} onClick={() => setPaused((value) => !value)} className="inline-flex items-center gap-1.5 rounded-lg p-2 text-xs hover:bg-ink-100">{paused ? <Play className="size-4" /> : <Pause className="size-4" />}{paused ? "Play" : "Pause"}</button>
          <button type="button" aria-label="Next item" onClick={() => move(1)} className="rounded-lg p-2 hover:bg-ink-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"><ChevronRight className="size-4" /></button>
        </div>
      ) : null}
    </section>
  );
}
