import { randomUUID } from "node:crypto";
import { mkdir, open, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { systemDb, withSystem } from "@/lib/db";
import { canonicalMediaMime, matchesMediaSignature, MAX_PRODUCT_MEDIA_BYTES, validateProductMedia, type UploadedProductMedia } from "@/lib/product-media";

export interface MediaUpload {
  id: string;
  store_id: string;
  object_path: string;
  url: string;
  mime_type: string;
  byte_size: number;
  status: "pending" | "ready" | "failed";
  expires_at: string;
}

function storageConfig() {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "storefronts";
  if (base && key) return { base, key, bucket };
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) throw new Error("Media storage is not configured. Please contact Ibom Vendors Hub support.");
  return null;
}

export function localMediaPath(upload: Pick<MediaUpload, "object_path">) {
  const filename = path.basename(upload.object_path);
  if (!/^[0-9a-f-]{36}\.[a-z0-9]+$/.test(filename)) throw new Error("Invalid media path.");
  return path.join(process.cwd(), ".data", "vendor-media", filename);
}

function uploadResult(upload: MediaUpload): UploadedProductMedia {
  return { id: upload.id, url: upload.url, mime_type: upload.mime_type, byte_size: Number(upload.byte_size) };
}

export async function createProductMediaUpload(store: { id: string; slug: string }, file: { name: string; type: string; size: number }) {
  const { mimeType, extension } = validateProductMedia(file);
  const config = storageConfig();
  const id = randomUUID();
  const objectPath = `stores/${store.slug}/products/${id}.${extension}`;
  const publicUrl = config
    ? `${config.base}/storage/v1/object/public/${config.bucket}/${objectPath}`
    : `/api/vendor-media/${id}.${extension}`;
  // Persistent throttling also works across independent serverless instances.
  const recent = await systemDb.one<{ count: number }>(`select count(*)::int as count from vendor_media_uploads where store_id=$1 and created_at > now()-interval '10 minutes'`, [store.id]);
  if (recent.count >= 60) throw new Error("Too many uploads. Please wait a few minutes before adding more media.");
  const upload = await systemDb.one<MediaUpload>(
    `insert into vendor_media_uploads(id,store_id,object_path,url,mime_type,byte_size) values($1,$2,$3,$4,$5,$6) returning *`,
    [id, store.id, objectPath, publicUrl, mimeType, file.size],
  );
  try {
    let uploadUrl = `/api/vendor-media/${id}`;
    if (config) {
      const response = await fetch(`${config.base}/storage/v1/object/upload/sign/${config.bucket}/${objectPath}`, {
        method: "POST", headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json", "x-upsert": "false" },
        body: "{}", cache: "no-store", signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error("Could not prepare storage for this upload. Please try again.");
      const signed = await response.json() as { url?: string };
      if (!signed.url) throw new Error("Storage did not return an upload URL.");
      uploadUrl = signed.url.startsWith("/object/") ? `${config.base}/storage/v1${signed.url}` : new URL(signed.url, `${config.base}/storage/v1/`).toString();
      const target = new URL(uploadUrl);
      if (target.origin !== new URL(config.base).origin || target.pathname !== `/storage/v1/object/upload/sign/${config.bucket}/${objectPath}` || !target.searchParams.has("token")) {
        throw new Error("Storage returned an invalid upload URL.");
      }
    }
    // The signed token only permits one new object at this server-chosen path.
    // The service-role key is NEVER included in the response.
    return { id: upload.id, uploadUrl, mimeType, maxBytes: MAX_PRODUCT_MEDIA_BYTES };
  } catch (error) {
    await systemDb.execute(`update vendor_media_uploads set status='failed' where id=$1`, [id]);
    throw error;
  }
}

export async function findProductMediaUpload(id: string, storeId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  return systemDb.maybeOne<MediaUpload>(`select * from vendor_media_uploads where id=$1 and store_id=$2`, [id, storeId]);
}

/** Development-only streaming sink. Production files go directly to Supabase. */
export async function writeLocalProductMedia(upload: MediaUpload, request: Request) {
  if (storageConfig()) throw new Error("Use the signed storage URL for this upload.");
  if (upload.status !== "pending" || new Date(upload.expires_at).getTime() <= Date.now()) throw new Error("This upload has expired. Choose the file again.");
  if (canonicalMediaMime(request.headers.get("content-type") ?? "") !== upload.mime_type) throw new Error("The upload's media type changed. Choose the file again.");
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && Number(declaredLength) !== Number(upload.byte_size)) throw new Error("The file size does not match this upload.");
  if (!request.body) throw new Error("No media received.");
  const filename = localMediaPath(upload);
  await mkdir(path.dirname(filename), { recursive: true });
  const file = await open(filename, "wx");
  const reader = request.body.getReader();
  let total = 0;
  let valid = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_PRODUCT_MEDIA_BYTES || total > Number(upload.byte_size)) throw new Error("Media exceeds the permitted file size (100 MB maximum).");
      await file.writeFile(value);
    }
    if (total !== Number(upload.byte_size)) throw new Error("The upload was incomplete. Choose the file again.");
    valid = true;
  } finally {
    await reader.cancel().catch(() => {});
    await file.close();
    if (!valid) await unlink(filename).catch(() => {});
  }
}

async function readPrefix(response: Response): Promise<Uint8Array> {
  if (!response.ok || !response.body) throw new Error("The uploaded media could not be read. Please retry.");
  const reader = response.body.getReader();
  const prefix = new Uint8Array(4096);
  let offset = 0;
  try {
    while (offset < prefix.length) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, prefix.length - offset);
      prefix.set(chunk, offset); offset += chunk.length;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return prefix.subarray(0, offset);
}

export async function completeProductMediaUpload(upload: MediaUpload) {
  if (new Date(upload.expires_at).getTime() <= Date.now()) throw new Error("This upload has expired. Choose the file again.");
  if (upload.status === "ready") return uploadResult(upload);
  if (upload.status !== "pending") throw new Error("This upload has expired. Choose the file again.");
  const config = storageConfig();
  let size: number;
  let mimeType = upload.mime_type;
  let prefix: Uint8Array;
  if (config) {
    // Only inspect the canonical, server-generated storage URL (no user URLs/SSRF).
    const expected = `${config.base}/storage/v1/object/public/${config.bucket}/${upload.object_path}`;
    if (upload.url !== expected) throw new Error("Media storage configuration changed. Upload the file again.");
    const head = await fetch(expected, { method: "HEAD", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30000) });
    if (!head.ok) throw new Error("The upload has not finished. Wait a moment and try again.");
    size = Number(head.headers.get("content-length"));
    mimeType = canonicalMediaMime(head.headers.get("content-type") ?? "");
    prefix = await readPrefix(await fetch(expected, { headers: { Range: "bytes=0-4095" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30000) }));
  } else {
    const filename = localMediaPath(upload);
    size = (await stat(filename)).size;
    const file = await open(filename, "r");
    try { const buffer = Buffer.alloc(4096); const result = await file.read(buffer, 0, buffer.length, 0); prefix = buffer.subarray(0, result.bytesRead); }
    finally { await file.close(); }
  }
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_PRODUCT_MEDIA_BYTES || size !== Number(upload.byte_size) || mimeType !== upload.mime_type || !matchesMediaSignature(prefix, mimeType)) {
    await systemDb.execute(`update vendor_media_uploads set status='failed' where id=$1`, [upload.id]);
    // Invalid files cannot be published; remove the rejected object as well.
    if (config) {
      await fetch(`${config.base}/storage/v1/object/${config.bucket}`, { method: "DELETE", headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: [upload.object_path] }) }).catch(() => {});
    } else await unlink(localMediaPath(upload)).catch(() => {});
    throw new Error("The file content, type or size does not match a supported media file (maximum 100 MB). Choose the original file, not a renamed document.");
  }
  const completed = await systemDb.maybeOne<MediaUpload>(
    `update vendor_media_uploads set status='ready', expires_at=now()+interval '24 hours'
      where id=$1 and status='pending' and expires_at > clock_timestamp() returning *`, [upload.id],
  );
  if (completed) return uploadResult(completed);
  // Another completion may have won, or cleanup may have claimed an expired
  // upload while storage was responding. Never report a failed receipt as ready.
  const current = await findProductMediaUpload(upload.id, upload.store_id);
  if (current?.status === "ready" && new Date(current.expires_at).getTime() > Date.now()) return uploadResult(current);
  throw new Error("This upload has expired. Choose the file again.");
}

export async function readLocalProductMedia(filename: string) {
  if (storageConfig()) return null;
  if (!/^[0-9a-f-]{36}\.[a-z0-9]+$/.test(filename)) return null;
  const id = filename.slice(0, 36);
  const upload = await systemDb.maybeOne<MediaUpload>(`select * from vendor_media_uploads where id=$1 and status='ready'`, [id]);
  if (!upload || path.basename(upload.object_path) !== filename) return null;
  // Used only for local development. The production CDN supplies byte ranges.
  return { upload, filename: localMediaPath(upload) };
}

/** Clear abandoned uploads after their save window, never media in a listing. */
export async function cleanupExpiredProductMedia() {
  const uploads = await withSystem(async db => {
    const candidates = await db.query<{ id: string }>(
      `select u.id from vendor_media_uploads u where u.expires_at < now()
         and not exists(select 1 from product_images i where i.upload_id=u.id or i.url=u.url)
         order by u.expires_at limit 100 for update skip locked`,
    );
    if (!candidates.length) return [];
    // A separate statement gets a fresh READ COMMITTED snapshot after locking.
    // Attachment triggers take a conflicting share lock until their save commits.
    // Marking failed before any storage request blocks later attachments, and a
    // failed deletion leaves expired receipts available for the next cron retry.
    return db.query<MediaUpload>(
      `update vendor_media_uploads u set status='failed' where id=any($1::uuid[]) and expires_at < now()
         and not exists(select 1 from product_images i where i.upload_id=u.id or i.url=u.url) returning u.*`,
      [candidates.map(upload => upload.id)],
    );
  });
  if (!uploads.length) return { removed: 0 };
  const config = storageConfig();
  if (config) {
    const result = await fetch(`${config.base}/storage/v1/object/${config.bucket}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: uploads.map(upload => upload.object_path) }), signal: AbortSignal.timeout(15000),
    });
    if (!result.ok) return { removed: 0, retry: uploads.length };
  } else {
    for (const upload of uploads) await unlink(localMediaPath(upload)).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
  }
  const removed = await systemDb.execute(`delete from vendor_media_uploads u where id=any($1::uuid[]) and status='failed' and expires_at < now()
    and not exists(select 1 from product_images i where i.upload_id=u.id or i.url=u.url)`, [uploads.map(upload => upload.id)]);
  return { removed };
}
