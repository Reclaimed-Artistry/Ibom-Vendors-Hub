import { NextResponse } from "next/server";
import { getCurrentUser, getVendorContext, rateLimit, vendorSuspensionMessage } from "@/lib/auth";

export async function mediaVendor(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? new URL(request.url).host;
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && (() => { try { return new URL(origin).host !== host; } catch { return true; } })())) {
    return { response: NextResponse.json({ error: "Uploads must be made from your vendor dashboard." }, { status: 403 }) };
  }
  const user = await getCurrentUser();
  if (!user) return { response: NextResponse.json({ error: "Sign in to upload listing media." }, { status: 401 }) };
  if (user.role !== "vendor") return { response: NextResponse.json({ error: "Only vendors can upload listing media." }, { status: 403 }) };
  const ctx = await getVendorContext();
  const error = vendorSuspensionMessage(ctx);
  if (error) return { response: NextResponse.json({ error }, { status: 403 }) };
  if (!rateLimit(`vendor-media:${user.id}`, 120, 10 * 60_000).allowed) return { response: NextResponse.json({ error: "Too many upload requests. Please wait a few minutes." }, { status: 429 }) };
  return { ctx };
}

export async function smallMediaJson(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("Send upload details as JSON.");
  if (!request.body) throw new Error("No upload details received.");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let length = 0, text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 8192) throw new Error("Upload details are too large. Files must go directly to storage.");
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally { await reader.cancel().catch(() => {}); }
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid upload details.");
  return parsed as Record<string, unknown>;
}

export function mediaError(error: unknown) {
  return NextResponse.json({ error: error instanceof Error ? error.message : "Media upload failed. Please try again." }, { status: 400 });
}
