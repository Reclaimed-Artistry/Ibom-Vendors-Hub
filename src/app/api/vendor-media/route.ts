import { NextResponse } from "next/server";
import { mediaError, mediaVendor, smallMediaJson } from "@/lib/vendor-media-request";
import { createProductMediaUpload } from "@/lib/vendor-media-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Issue a single-object upload capability. No file bytes pass through Vercel. */
export async function POST(request: Request) {
  const access = await mediaVendor(request);
  if (access.response) return access.response;
  try {
    const body = await smallMediaJson(request);
    if (typeof body.name !== "string" || body.name.length > 255 || typeof body.type !== "string" || body.type.length > 100 || typeof body.size !== "number") throw new Error("Invalid file details.");
    const result = await createProductMediaUpload(access.ctx.store, { name: body.name, type: body.type, size: body.size });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return mediaError(error); }
}
