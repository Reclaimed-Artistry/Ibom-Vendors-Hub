"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ImageIcon, Music2, Play } from "lucide-react";
import { mediaKind } from "@/lib/product-media";
import { cn } from "@/lib/utils";
import { observeVideoAutoplay } from "@/lib/video-autoplay";

/** One renderer for listing cards, editor previews, carts and the full gallery. */
export function ListingMedia({ src, mimeType, alt, className, player = false, autoPlayInView = true }: {
  src: string;
  mimeType?: string | null;
  alt: string;
  className?: string;
  player?: boolean;
  /** Disable for editor previews, carts and decorative gallery thumbnails. */
  autoPlayInView?: boolean;
}) {
  const kind = mediaKind({ url: src, mime_type: mimeType });
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => setFailed(false), [src]);
  useEffect(() => {
    if (kind !== "video" || !autoPlayInView || failed || !videoRef.current) return;
    return observeVideoAutoplay(videoRef.current);
  }, [src, kind, autoPlayInView, failed]);
  return <div className={cn("relative overflow-hidden bg-ink-50", player && kind !== "image" && "flex flex-col", className)}>
    <div className={cn("relative size-full", player && kind !== "image" && "min-h-0 flex-1")}>
    {kind === "image" ? failed
      ? <span role="img" aria-label={alt} className="flex size-full items-center justify-center text-ink-300"><ImageIcon className="size-10" /></span>
      : <Image src={src} alt={alt} loading="lazy" className="size-full object-cover" fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" onError={() => setFailed(true)} />
      : kind === "video" ? <>
        {!failed ? <video key={src} ref={videoRef} src={src} controls={player} muted={autoPlayInView || !player} playsInline loop={!player && autoPlayInView}
          preload={autoPlayInView ? "none" : "metadata"} tabIndex={player ? undefined : -1}
          aria-label={player ? `${alt} — video` : undefined} aria-hidden={player ? undefined : true}
          className={cn("size-full bg-ink-950 object-contain", !player && "pointer-events-none object-cover")}
          onError={() => setFailed(true)}>
          Your browser cannot play this video.
        </video> : <span role="img" aria-label={`${alt} — video`} className="flex size-full items-center justify-center bg-ink-900 text-white"><Play className="size-12" /></span>}
        {!player ? <span className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold text-white"><Play className="size-3" fill="currentColor" /> Video</span> : null}
      </> : <div className="flex size-full flex-col items-center justify-center gap-3 bg-brand-50 p-3 text-brand-800">
        <Music2 className={player ? "size-12" : "size-8"} aria-hidden="true" />
        <span className="text-xs font-semibold">{player ? alt : "Audio"}</span>
        {player ? <audio src={src} controls preload="metadata" aria-label={`${alt} — audio`} className="max-w-full" onError={() => setFailed(true)}>Your browser cannot play this audio.</audio> : null}
      </div>}
    </div>
    {player && kind !== "image" ? <div className="shrink-0 bg-white/95 px-3 py-2 text-center text-xs text-ink-600">
      {failed ? "This browser cannot play this format. " : "Playback depends on your browser and the file's codec. "}
      <a href={src} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-800 underline">Open {kind} file</a>
    </div> : null}
  </div>;
}
