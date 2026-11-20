"use client";

import { useState } from "react";
import { ListingMedia } from "@/components/listing-media";
import { mediaKind, type ListingMediaItem } from "@/lib/product-media";

export function ProductMediaGallery({ items, name }: { items: ListingMediaItem[]; name: string }) {
  const [selected, setSelected] = useState(0);
  const media = items.length ? items : [{ url: "/images/seed/product-jollof.svg" }];
  const active = media[Math.min(selected, media.length - 1)];
  return <section aria-label={`${name} photos, videos and audio`} className="min-w-0">
    <ListingMedia key={active.url} src={active.url} mimeType={active.mime_type} alt={active.alt || name} player className="aspect-square w-full rounded-2xl border border-ink-100" />
    {media.length > 1 ? <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5" aria-label="Choose listing media">
      {media.map((item, index) => <button type="button" key={item.id || `${item.url}-${index}`} aria-pressed={index === selected}
        aria-label={`View ${mediaKind(item)} ${index + 1} of ${media.length}`} onClick={() => setSelected(index)}
        className={`overflow-hidden rounded-xl border-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 ${index === selected ? "border-brand-600" : "border-transparent"}`}>
        <ListingMedia autoPlayInView={false} src={item.url} mimeType={item.mime_type} alt={`${name} — view ${index + 1}`} className="aspect-square w-full" />
      </button>)}
    </div> : null}
    <p className="mt-2 text-xs text-ink-500" aria-live="polite">{selected + 1} / {media.length} · {mediaKind(active) === "image" ? "Photo / GIF" : mediaKind(active) === "video" ? "Video — autoplays muted; use controls for sound" : "Audio — press play to listen"}</p>
  </section>;
}
