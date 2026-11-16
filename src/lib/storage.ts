import crypto from "node:crypto";
import { mkdir, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
const ALLOWED_DOCS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function resolveMimeType(file: File): string {
  const raw = (file.type || "").trim().toLowerCase();
  if (raw === "image/jpg" || raw === "image/pjpeg") return "image/jpeg";
  if (raw && raw !== "application/octet-stream") return raw;

  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    case "pdf":
      return "application/pdf";
    default:
      return raw;
  }
}

async function storeBytes(
  file: File,
  folder: string,
  allowedTypes: string[],
  allowDataUriFallback = false,
): Promise<string> {
  if (!file || typeof file === "string" || file.size === 0) {
    throw new Error("No file received");
  }
  const mimeType = resolveMimeType(file);
  if (!allowedTypes.includes(mimeType)) {
    throw new Error(
      allowedTypes.includes("application/pdf")
        ? "Only JPEG, PNG, WEBP images or PDF documents are allowed"
        : "Only JPEG, PNG, WEBP, GIF or SVG images are allowed",
    );
  }
  if (file.size > MAX_BYTES) {
    throw new Error("File must be smaller than 10MB");
  }

  const defaultExt = mimeType === "application/pdf" ? "pdf" : "jpg";
  const extension =
    (file.name.split(".").pop() ?? defaultExt).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || defaultExt;
  const safeFolder = folder.replace(/[^a-z0-9-/]/gi, "").replace(/^\/+|\/+$/g, "").slice(0, 50) || "general";
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${extension}`;
  const objectPath = `${safeFolder}/${filename}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "storefronts";

  if (supabaseUrl && serviceKey) {
    try {
      const response = await fetch(
        `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/${bucket}/${objectPath}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": mimeType,
            "x-upsert": "true",
          },
          body: bytes,
        },
      );
      if (response.ok) {
        return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${objectPath}`;
      }
      const detail = await response.text();
      if (allowDataUriFallback && file.size <= 2 * 1024 * 1024) {
        console.warn("[storage] Supabase bucket upload failed, falling back to inline data URI:", detail.slice(0, 200));
        return `data:${mimeType};base64,${bytes.toString("base64")}`;
      }
      throw new Error(`Storage upload failed: ${detail.slice(0, 200)}`);
    } catch (err) {
      if (allowDataUriFallback && file.size <= 2 * 1024 * 1024) {
        console.warn("[storage] Supabase upload exception, falling back to inline data URI:", err);
        return `data:${mimeType};base64,${bytes.toString("base64")}`;
      }
      throw err;
    }
  }

  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    if (allowDataUriFallback && file.size <= 2 * 1024 * 1024) {
      return `data:${mimeType};base64,${bytes.toString("base64")}`;
    }
    throw new Error(
      "Storage is not configured on this deployment (or file exceeds 2MB inline limit). Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_STORAGE_BUCKET.",
    );
  }

  const directory = path.join(process.cwd(), "public", "uploads", safeFolder);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), bytes);
  return `/uploads/${objectPath}`;
}

/**
 * Image storage abstraction.
 */
export async function uploadImage(file: File, folder = "general"): Promise<string> {
  return storeBytes(file, folder, ALLOWED_IMAGES, true);
}

/**
 * Verification document upload (Proof of Residence: JPG, PNG, WEBP, or PDF).
 */
export async function uploadVerificationDocument(file: File, folder = "vendor-kyc"): Promise<string> {
  return storeBytes(file, folder, ALLOWED_DOCS, true);
}

/**
 * Remove stored files (Supabase Storage public URLs or local /uploads/... paths).
 * Best-effort and never throws, so DB deletion always completes cleanly.
 */
export async function deleteStoredFiles(urls: Array<string | null | undefined>): Promise<void> {
  const unique = [...new Set(urls.map((u) => (u ?? "").trim()).filter(Boolean))];
  if (unique.length === 0) return;

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "storefronts";
  const publicPrefix = supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/${bucket}/` : "";

  const bucketPaths: string[] = [];
  for (const fileUrl of unique) {
    if (fileUrl.startsWith("data:") || fileUrl.startsWith("/images/seed/")) continue;
    if (publicPrefix && fileUrl.startsWith(publicPrefix)) {
      const objectPath = decodeURIComponent(fileUrl.slice(publicPrefix.length).split("?")[0]);
      if (objectPath) bucketPaths.push(objectPath);
      continue;
    }
    if (fileUrl.startsWith("/uploads/") && !process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
      const rel = fileUrl.replace(/^\/uploads\//, "").replace(/\.\./g, "");
      if (rel) {
        await unlink(path.join(process.cwd(), "public", "uploads", rel)).catch(() => {});
      }
    }
  }

  if (bucketPaths.length > 0 && supabaseUrl && serviceKey) {
    try {
      await fetch(`${supabaseUrl}/storage/v1/object/${bucket}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prefixes: bucketPaths }),
      });
    } catch (err) {
      console.warn("[storage] Non-fatal Supabase object cleanup error:", err);
    }
  }
}

/**
 * Purge all objects stored under `stores/<slug>/...` when a storefront is deleted.
 */
export async function deleteStoreStorageFolder(slug: string): Promise<void> {
  const cleanSlug = slug.replace(/[^a-z0-9-]/gi, "");
  if (!cleanSlug) return;

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "storefronts";

  if (supabaseUrl && serviceKey) {
    for (const sub of ["products", "branding", "uploads", ""]) {
      const prefix = sub ? `stores/${cleanSlug}/${sub}` : `stores/${cleanSlug}`;
      try {
        const listRes = await fetch(`${supabaseUrl}/storage/v1/object/list/${bucket}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ prefix, limit: 200 }),
        });
        if (!listRes.ok) continue;
        const items = (await listRes.json()) as Array<{ name?: string; id?: string | null }>;
        const paths = items
          .filter((item) => item.name && item.id)
          .map((item) => `${prefix}/${item.name}`);
        if (paths.length > 0) {
          await fetch(`${supabaseUrl}/storage/v1/object/${bucket}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ prefixes: paths }),
          });
        }
      } catch {
        /* ignore non-fatal cleanup errors */
      }
    }
  }

  if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    await rm(path.join(process.cwd(), "public", "uploads", "stores", cleanSlug), {
      recursive: true,
      force: true,
    }).catch(() => {});
  }
}
