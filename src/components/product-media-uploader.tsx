"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Plus, X } from "lucide-react";
import { ListingMedia } from "@/components/listing-media";
import { Alert } from "@/components/ui";
import { MAX_PRODUCT_MEDIA_COUNT, PRODUCT_MEDIA_ACCEPT, PRODUCT_MEDIA_HELP, type ListingMediaItem, type UploadedProductMedia } from "@/lib/product-media";
import { uploadProductMedia, type MediaUploadProgress } from "@/lib/product-media-upload";

export function ProductMediaUploader({ existing, onBusyChange }: { existing: Array<ListingMediaItem & { id: string }>; onBusyChange: (busy: boolean) => void }) {
  const [uploaded, setUploaded] = useState<UploadedProductMedia[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [progress, setProgress] = useState<MediaUploadProgress & { name: string; position: number; total: number } | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    // A same-page server-action redirect can preserve this component's state.
    // Once receipts become saved rows, do not count or resubmit them as new.
    setUploaded(current => {
      const next = current.filter(item => !existing.some(saved => saved.url === item.url));
      return next.length === current.length ? current : next;
    });
    setRemoved(current => {
      const next = current.filter(id => existing.some(saved => saved.id === id));
      return next.length === current.length ? current : next;
    });
  }, [existing]);
  const kept = existing.filter(item => !removed.includes(item.id));
  const additions = uploaded.filter(item => !existing.some(saved => saved.url === item.url));
  const count = kept.length + additions.length;

  async function choose(files: File[]) {
    if (!files.length || busy) return;
    setErrors([]);
    if (count + files.length > MAX_PRODUCT_MEDIA_COUNT) {
      setErrors([`A listing can have up to ${MAX_PRODUCT_MEDIA_COUNT} media files. Choose at most ${MAX_PRODUCT_MEDIA_COUNT - count} more, or remove an existing file.`]); return;
    }
    const batch = new AbortController();
    controller.current = batch;
    setBusy(true); onBusyChange(true);
    try {
      for (const [index, file] of files.entries()) {
        if (batch.signal.aborted) break;
        try {
          setProgress({ name: file.name, position: index + 1, total: files.length, percent: 0, stage: "preparing" });
          const media = await uploadProductMedia(file, update => setProgress({ ...update, name: file.name, position: index + 1, total: files.length }), batch.signal);
          setUploaded(current => [...current, media]);
        } catch (error) {
          setErrors(current => [...current, `${file.name}: ${batch.signal.aborted ? "Upload cancelled." : error instanceof Error ? error.message : "Could not upload. Please try again."}`]);
        }
      }
    } finally { setBusy(false); onBusyChange(false); setProgress(null); controller.current = null; }
  }

  return <div className="space-y-3">
    <p className="text-sm text-ink-500">Show the actual item or examples of your work. The first file is the cover. Up to 10 media files.</p>
    <p className="text-xs leading-5 text-ink-500">{PRODUCT_MEDIA_HELP} GIFs stay animated. MP4 (H.264/AAC) is recommended for the widest video support. Videos/audio play only when customers choose to play them.</p>
    {removed.map(id => <input key={id} type="hidden" name="removeImage" value={id} />)}
    {additions.map(item => <input key={item.id} type="hidden" name="uploadedMediaIds" value={item.id} />)}
    {existing.length || additions.length ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {existing.map(item => {
        const deleted = removed.includes(item.id);
        return <div key={item.id} className={`relative overflow-hidden rounded-xl border ${deleted ? "border-red-300 opacity-40" : "border-ink-200"}`}>
          <ListingMedia src={item.url} mimeType={item.mime_type} alt="Existing listing" className="h-24 w-full" />
          {!deleted && kept[0]?.id === item.id ? <span className="absolute left-1 top-1 rounded bg-brand-800/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">Cover</span> : null}
          <button type="button" disabled={busy} aria-label={deleted ? "Keep media" : "Remove media"} onClick={() => setRemoved(current => deleted ? current.filter(id => id !== item.id) : [...current, item.id])} className="absolute right-1 top-1 rounded-full bg-white/95 p-1.5 text-ink-700 shadow-sm disabled:opacity-50">{deleted ? <Plus className="size-3.5" /> : <X className="size-3.5" />}</button>
        </div>;
      })}
      {additions.map((item, index) => <div key={item.id} className="relative overflow-hidden rounded-xl border border-brand-300">
        <ListingMedia src={item.url} mimeType={item.mime_type} alt="New listing media" className="h-24 w-full" />
        <span className="absolute left-1 top-1 rounded bg-brand-800/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">{!kept.length && index === 0 ? "Cover" : "Ready"}</span>
        <button type="button" disabled={busy} aria-label="Remove new media" onClick={() => setUploaded(current => current.filter(media => media.id !== item.id))} className="absolute right-1 top-1 rounded-full bg-white/95 p-1.5 text-ink-700 shadow-sm disabled:opacity-50"><X className="size-3.5" /></button>
      </div>)}
    </div> : null}
    <label className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ink-300 bg-ink-50 p-5 text-center text-sm ${busy || count >= MAX_PRODUCT_MEDIA_COUNT ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-brand-500 hover:bg-brand-50/40"}`}>
      {busy ? <Loader2 className="size-5 animate-spin text-brand-700" /> : <ImagePlus className="size-5 text-brand-700" />}
      <span className="font-semibold text-ink-800">{busy ? "Uploading media…" : `Choose photos, GIFs, videos or audio (${count}/10)`}</span>
      <span className="text-xs text-ink-500">100 MB maximum per file</span>
      <input type="file" multiple accept={PRODUCT_MEDIA_ACCEPT} className="sr-only" aria-label="Choose listing media" disabled={busy || count >= MAX_PRODUCT_MEDIA_COUNT} onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void choose(files); }} />
    </label>
    {progress ? <div className="space-y-2 rounded-xl border border-brand-100 bg-brand-50 p-3">
      <p className="break-words text-xs text-brand-900" aria-live="polite">{progress.position}/{progress.total} · {progress.stage === "verifying" ? "Checking uploaded file" : progress.stage === "preparing" ? "Preparing" : `Uploading ${progress.percent}%`} — {progress.name}</p>
      <progress value={progress.percent} max={100} aria-label={`Upload progress for ${progress.name}`} className="h-2 w-full accent-brand-700" />
      <button type="button" onClick={() => controller.current?.abort()} className="text-xs font-semibold text-brand-800 underline">Cancel upload</button>
    </div> : null}
    {errors.length ? <Alert tone="danger"><ul className="space-y-1">{errors.map((error, index) => <li key={index} className="break-words">{error}</li>)}</ul></Alert> : null}
  </div>;
}
