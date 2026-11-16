import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];

/**
 * Image storage abstraction.
 *
 * When Supabase Storage credentials are present the file is uploaded to the
 * configured bucket (works on serverless hosts such as Vercel). Otherwise files
 * are written to /public/uploads, which is ideal for local development.
 */
export async function uploadImage(file: File, folder = "general"): Promise<string> {
  if (!file || typeof file === "string" || file.size === 0) {
    throw new Error("No file received");
  }
  if (!ALLOWED.includes(file.type)) {
    throw new Error("Only JPEG, PNG, WEBP, GIF or SVG images are allowed");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Images must be smaller than 6MB");
  }

  const extension = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
  const safeFolder = folder.replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "general";
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${extension}`;
  const objectPath = `${safeFolder}/${filename}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "storefronts";

  if (supabaseUrl && serviceKey) {
    const response = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/${bucket}/${objectPath}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": file.type,
          "x-upsert": "true",
        },
        body: bytes,
      },
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Storage upload failed: ${detail.slice(0, 200)}`);
    }
    return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${objectPath}`;
  }

  // Serverless filesystems are read-only (and wiped between invocations), so a
  // file written there would 404 the moment the response finished. Refusing is
  // louder and safer than handing back a URL that cannot resolve.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    throw new Error(
      "Image storage is not configured on this deployment. Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_STORAGE_BUCKET.",
    );
  }

  const directory = path.join(process.cwd(), "public", "uploads", safeFolder);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), bytes);
  return `/uploads/${objectPath}`;
}
