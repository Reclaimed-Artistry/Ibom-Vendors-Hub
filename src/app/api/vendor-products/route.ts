import { NextResponse } from "next/server";
import { saveProductAction } from "@/app/actions/vendor";
import { getCurrentUser, getVendorContext, rateLimit, vendorSuspensionMessage } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { PRODUCT_SAVE_NAVIGATION_FIELD } from "@/lib/product-save-navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const MAX_DETAILS_BYTES = 256 * 1024;

function json(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

/** Small listing details only. Media bytes still upload directly to storage. */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? new URL(request.url).host;
  try {
    if (!origin || request.headers.get("sec-fetch-site") === "cross-site" || new URL(origin).host !== host || !/^https?:$/.test(new URL(origin).protocol)) {
      return json({ error: "Save products from your own vendor dashboard." }, 403);
    }
  } catch { return json({ error: "Invalid dashboard origin." }, 403); }
  const user = await getCurrentUser();
  if (!user) return json({ error: "Sign in to save products." }, 401);
  if (user.role !== "vendor") return json({ error: "Only vendors can save products." }, 403);
  if (!await systemDb.maybeOne("select id from stores where owner_id=$1 limit 1", [user.id])) return json({ error: "Create your storefront before adding products." }, 403);
  const ctx = await getVendorContext();
  const lock = vendorSuspensionMessage(ctx);
  if (lock) return json({ error: lock }, 403);
  if (!rateLimit(`vendor-product-save:${user.id}`, 120, 10 * 60_000).allowed) return json({ error: "Too many save requests. Wait a few minutes and try again." }, 429);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "Send listing details as JSON; upload files using the media picker." }, 415);
  if (Number(request.headers.get("content-length")) > MAX_DETAILS_BYTES) return json({ error: "Listing details are too large. Upload media using the media picker." }, 413);
  if (!request.body) return json({ error: "No listing details received." }, 400);

  try {
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0, text = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_DETAILS_BYTES) return json({ error: "Listing details are too large. Upload media using the media picker." }, 413);
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally { await reader.cancel().catch(() => {}); }
    const entries: unknown = JSON.parse(text);
    if (!Array.isArray(entries) || entries.length > 300) return json({ error: "Invalid listing details." }, 400);
    const data = new FormData();
    for (const entry of entries) {
      if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string" || entry[0].length > 80 || typeof entry[1] !== "string") return json({ error: "Invalid listing field." }, 400);
      if (!entry[0].startsWith("$ACTION_")) data.append(entry[0], entry[1]);
    }
    data.set(PRODUCT_SAVE_NAVIGATION_FIELD, "1");
    const result = await saveProductAction({}, data);
    return json(result, result.error || result.fieldErrors ? 422 : 200);
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Invalid listing details." }, 400);
    console.error("Product save request failed", error);
    return json({ error: "Could not confirm the save. Check your Products list before trying again." }, 500);
  }
}
