/** Shared by the file picker and server. Do not import server-only code here. */
export const MAX_PRODUCT_MEDIA_BYTES = 100 * 1024 * 1024;
export const MAX_PRODUCT_MEDIA_COUNT = 10;
export const PRODUCT_MEDIA_HELP = "JPG, PNG, WebP, GIF, AVIF; MP4, WebM, MOV, M4V; MP3, WAV, OGG, M4A. Up to 100 MB per file.";

const formats = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif",
  mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm", mov: "video/quicktime",
  mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", oga: "audio/ogg", m4a: "audio/mp4",
} as const;
export const PRODUCT_MEDIA_MIME_TYPES = [...new Set(Object.values(formats))];
export const PRODUCT_MEDIA_ACCEPT = [...PRODUCT_MEDIA_MIME_TYPES, ...Object.keys(formats).map(extension => `.${extension}`)].join(",");
export type MediaKind = "image" | "video" | "audio";
export interface ListingMediaItem {
  id?: string;
  url: string;
  alt?: string | null;
  mime_type?: string | null;
  byte_size?: number | null;
}
export interface UploadedProductMedia extends ListingMediaItem {
  id: string;
  mime_type: string;
  byte_size: number;
}

export function canonicalMediaMime(type: string): string {
  const mime = type.split(";")[0].trim().toLowerCase();
  const aliases: Record<string, string> = {
    "image/jpg": "image/jpeg", "image/pjpeg": "image/jpeg", "video/x-m4v": "video/mp4",
    "audio/x-wav": "audio/wav", "audio/wave": "audio/wav", "audio/vnd.wave": "audio/wav",
    "audio/mp3": "audio/mpeg", "audio/x-m4a": "audio/mp4", "application/ogg": "audio/ogg",
  };
  return aliases[mime] ?? mime;
}

export function validateProductMedia(file: { name: string; type: string; size: number }) {
  if (!Number.isSafeInteger(file.size) || file.size <= 0) throw new Error("Choose a non-empty media file.");
  if (file.size > MAX_PRODUCT_MEDIA_BYTES) throw new Error(`${file.name || "This file"} exceeds the 100 MB per-file limit.`);
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const expected = formats[extension as keyof typeof formats];
  const supplied = canonicalMediaMime(file.type || "");
  if (!expected || (supplied && supplied !== "application/octet-stream" && supplied !== expected)) {
    throw new Error("Unsupported media format. Use JPG, PNG, WebP, GIF, AVIF, MP4, WebM, MOV, M4V, MP3, WAV, OGG or M4A.");
  }
  // Use the type's canonical extension, not an arbitrary browser-supplied filename.
  return { mimeType: expected, extension: extension === "jpeg" ? "jpg" : extension === "m4v" ? "mp4" : extension === "oga" ? "ogg" : extension };
}

export function mediaKind(media: Pick<ListingMediaItem, "url" | "mime_type"> | string | null | undefined): MediaKind {
  const mime = typeof media === "object" && media ? canonicalMediaMime(media.mime_type ?? "") : "";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  const url = typeof media === "string" ? media : media?.url ?? "";
  const extension = url.split(/[?#]/)[0].split(".").pop()?.toLowerCase() ?? "";
  const inferred = formats[extension as keyof typeof formats] ?? "";
  if (inferred.startsWith("video/")) return "video";
  if (inferred.startsWith("audio/")) return "audio";
  return "image";
}

/** Social previews and JSON-LD image fields must never contain video/audio URLs. */
export function firstListingImage(items: ListingMediaItem[] | undefined): string | undefined {
  return items?.find(item => mediaKind(item) === "image")?.url;
}

/** Check the stored bytes too: a filename and Content-Type alone are not proof of a media file. */
export function matchesMediaSignature(bytes: Uint8Array, mime: string): boolean {
  const text = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  const has = (...prefix: number[]) => prefix.every((value, index) => bytes[index] === value);
  switch (canonicalMediaMime(mime)) {
    case "image/jpeg": return has(0xff, 0xd8, 0xff);
    case "image/png": return has(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/gif": return text(0, 6) === "GIF87a" || text(0, 6) === "GIF89a";
    case "image/webp": return text(0, 4) === "RIFF" && text(8, 12) === "WEBP";
    case "image/avif": return text(4, 8) === "ftyp" && /avif|avis/.test(text(8, 64));
    case "video/mp4": return text(4, 8) === "ftyp" && /isom|iso[2-9]|mp4[12v]|avc1|M4V |MSNV|dash|cmfc|cmfs/.test(text(8, 64));
    case "video/quicktime": return text(4, 8) === "ftyp" && text(8, 12) === "qt  " || ["moov", "mdat", "wide"].includes(text(4, 8));
    case "video/webm": return has(0x1a, 0x45, 0xdf, 0xa3) && text(0, 4096).includes("webm");
    case "audio/mpeg": return text(0, 3) === "ID3" || bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 && (bytes[1] & 0x06) !== 0;
    case "audio/wav": return text(0, 4) === "RIFF" && text(8, 12) === "WAVE";
    case "audio/ogg": return text(0, 4) === "OggS" && /OpusHead|vorbis|Speex|fLaC/.test(text(0, 256));
    case "audio/mp4": return text(4, 8) === "ftyp" && /M4A |M4B |isom|mp4[12]/.test(text(8, 64));
    default: return false;
  }
}
