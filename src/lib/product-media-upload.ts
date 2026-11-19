import { matchesMediaSignature, validateProductMedia, type UploadedProductMedia } from "@/lib/product-media";

export interface MediaUploadProgress { percent: number; stage: "preparing" | "uploading" | "verifying" }

async function jsonResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "Media upload failed. Check your connection and try again.");
  return body;
}

function putFile(url: string, file: File, type: string, onProgress: (progress: MediaUploadProgress) => void, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    const cleanup = () => signal?.removeEventListener("abort", abort);
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", type);
    request.timeout = 30 * 60_000;
    request.upload.onprogress = event => { if (event.lengthComputable) onProgress({ percent: Math.min(95, Math.round(event.loaded / event.total * 95)), stage: "uploading" }); };
    request.onerror = () => { cleanup(); reject(new Error("Upload interrupted. Check your connection and choose the file again.")); };
    request.ontimeout = () => { cleanup(); reject(new Error("The upload timed out. Try a faster connection or a smaller file.")); };
    request.onabort = () => { cleanup(); reject(new Error("Upload cancelled.")); };
    request.onload = () => {
      cleanup();
      if (request.status >= 200 && request.status < 300) { resolve(); return; }
      let detail = "";
      try { const error = JSON.parse(request.responseText); detail = String(error.message || error.error || ""); } catch { /* non-JSON storage error */ }
      reject(new Error(request.status === 413 || /maximum allowed size|exceed.*size|too large/i.test(detail)
        ? "Storage rejected this file's size. The storage project's upload limit must allow 100 MB. Try a smaller file or contact support."
        : "Storage could not accept this file. Check your connection and try again."));
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) { cleanup(); reject(new Error("Upload cancelled.")); return; }
    // Raw bytes go to the signed Storage URL, not a server action or API proxy.
    request.send(file);
  });
}

export async function uploadProductMedia(file: File, onProgress: (progress: MediaUploadProgress) => void = () => {}, signal?: AbortSignal): Promise<UploadedProductMedia> {
  const format = validateProductMedia(file);
  const prefix = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  if (!matchesMediaSignature(prefix, format.mimeType)) throw new Error(`${file.name} does not contain a supported media format. Choose the original file, not a renamed document.`);
  // Never send GIF, WebP, AVIF or video through a canvas: animations/audio must survive unchanged.
  onProgress({ percent: 0, stage: "preparing" });
  const prepared = await jsonResponse<{ id: string; uploadUrl: string; mimeType: string }>(await fetch("/api/vendor-media", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, type: file.type, size: file.size }), signal,
  }));
  await putFile(prepared.uploadUrl, file, prepared.mimeType, onProgress, signal);
  onProgress({ percent: 97, stage: "verifying" });
  const completed = await jsonResponse<{ media: UploadedProductMedia }>(await fetch(`/api/vendor-media/${prepared.id}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", signal,
  }));
  onProgress({ percent: 100, stage: "verifying" });
  return completed.media;
}
