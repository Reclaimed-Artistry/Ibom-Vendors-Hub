"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { Announcement, AnnouncementKind } from "@/lib/announcement-kinds";
import { ANNOUNCEMENT_STYLES } from "@/lib/announcement-style";
import { cn } from "@/lib/utils";

/**
 * The splash ticker: a full-width strip under the header where announcements
 * travel right → left. Everything is one row so the sweep never jumps; the row
 * is rendered twice so the loop is seamless, frozen on hover, and swapped for a
 * plain scrollable strip when the reader prefers reduced motion.
 */

const STORAGE_KEY = "ivh-ticker-dismissed";


function readingTime(item: Announcement) {
  const chars = item.title.length + item.message.length + (item.products?.length ?? 0) * 18;
  return Math.min(38, Math.max(14, Math.round(chars / 7)));
}

export function AnnouncementTicker({ items }: { items: Announcement[] }) {
  // Render server-side (no waiting on storage) so the strip is in the first paint;
  // any locally dismissed items drop out as soon as the effect runs.
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      setDismissed(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setDismissed([]);
    }
  }, []);

  if (!items.length) return null;
  const visible = items.filter((item) => !dismissed.includes(item.id));
  if (!visible.length) return null;

  const dismiss = (id: string) => {
    const next = [...dismissed, id].slice(-50);
    setDismissed(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage disabled — the strip simply comes back next visit */
    }
  };

  const tune = visible[0];
  const style = ANNOUNCEMENT_STYLES[tune.kind] ?? ANNOUNCEMENT_STYLES.info;

  const row = visible.map((item) => {
    const itemStyle = ANNOUNCEMENT_STYLES[item.kind] ?? ANNOUNCEMENT_STYLES.info;
    const ItemIcon = itemStyle.icon;
    const text = (
      <>
        <ItemIcon className="size-3.5 shrink-0" aria-hidden />
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] opacity-80">{itemStyle.label}</span>
        <span className="font-semibold">{item.title}</span>
        <span className="opacity-90">{item.message}</span>
        {item.products.length ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold">
            {item.products.slice(0, 3).map((product) => product.name).join(" · ")}
            {item.products.length > 3 ? ` +${item.products.length - 3}` : ""}
          </span>
        ) : null}
        {item.link_url ? (
          <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-ink-900">
            {item.cta_label || "See more"}
          </span>
        ) : null}
      </>
    );

    const body = item.link_url ? (
      <Link
        href={item.link_url}
        className="inline-flex items-center gap-2 underline-offset-4 hover:underline"
      >
        {text}
      </Link>
    ) : (
      <span className="inline-flex items-center gap-2">{text}</span>
    );

    return (
      <span key={item.id} className="inline-flex items-center gap-2 whitespace-nowrap">
        {body}
        <span aria-hidden className="px-6 opacity-40">
          •
        </span>
      </span>
    );
  });

  return (
    <div className={cn("relative w-full", style.bar)} role="region" aria-label="Announcements">
      <div className="group relative overflow-hidden">
        <div
          className="ivh-marquee flex w-max items-center py-2 text-[13px] motion-reduce:hidden"
          style={{ animationDuration: `${Math.max(18, readingTime(tune))}s` }}
        >
          <span className="flex min-w-full items-center justify-around gap-2 px-4">{row}</span>
          <span className="flex min-w-full items-center justify-around gap-2 px-4" aria-hidden>
            {row}
          </span>
        </div>
        {/* Reduced motion: same content, no movement. */}
        <div className="hidden gap-6 overflow-x-auto py-2 pl-4 pr-10 text-[13px] motion-reduce:flex">
          {row}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center gap-1 bg-gradient-to-l from-black/20 to-transparent pl-10 pr-2">
          <button
            type="button"
            onClick={() => visible.forEach((item) => dismiss(item.id))}
            className="pointer-events-auto rounded-full p-1 opacity-70 transition hover:bg-black/20 hover:opacity-100"
            aria-label="Dismiss announcements"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
