import { open, stat } from "node:fs/promises";
import { NextResponse } from "next/server";
import { mediaError, mediaVendor, smallMediaJson } from "@/lib/vendor-media-request";
import { completeProductMediaUpload, findProductMediaUpload, readLocalProductMedia, writeLocalProductMedia } from "@/lib/vendor-media-storage";

type Context = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Verify actual stored length, MIME and signature before a file can be published. */
export async function POST(request: Request, { params }: Context) {
  const access = await mediaVendor(request);
  if (access.response) return access.response;
  try {
    await smallMediaJson(request);
    const upload = await findProductMediaUpload((await params).id, access.ctx.store.id);
    if (!upload) return NextResponse.json({ error: "Upload not found." }, { status: 404 });
    return NextResponse.json({ media: await completeProductMediaUpload(upload) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return mediaError(error); }
}

/** Local development only. Never accepts file bodies on the hosted deployment. */
export async function PUT(request: Request, { params }: Context) {
  const access = await mediaVendor(request);
  if (access.response) return access.response;
  try {
    const upload = await findProductMediaUpload((await params).id, access.ctx.store.id);
    if (!upload) return NextResponse.json({ error: "Upload not found." }, { status: 404 });
    await writeLocalProductMedia(upload, request);
    return NextResponse.json({ uploaded: true });
  } catch (error) { return mediaError(error); }
}

/** Local byte-range delivery; Supabase's CDN handles this in production. */
export async function GET(request: Request, { params }: Context) {
  try {
    const media = await readLocalProductMedia((await params).id);
    if (!media) return new Response(null, { status: 404 });
    const size = (await stat(media.filename)).size;
    let start = 0, end = size - 1;
    const range = request.headers.get("range");
    if (range) {
      const parts = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!parts || !parts[1] && !parts[2]) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      if (!parts[1]) start = Math.max(0, size - Number(parts[2]));
      else { start = Number(parts[1]); if (parts[2]) end = Math.min(end, Number(parts[2])); }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const headers: Record<string, string> = {
      "Content-Type": media.upload.mime_type, "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "public, max-age=3600",
      ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
    };
    // Next may strip Content-Length from route responses. Content-Range still
    // carries the actual total for seeking; HEAD must not leave a file stream open.
    if (request.method === "HEAD") return new Response(null, { status: range ? 206 : 200, headers });
    const file = await open(media.filename, "r");
    let position = start, closed = false;
    // Browser metadata loads are often cancelled after the first few chunks.
    // Respect that cancellation without enqueueing into an already-closed stream.
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (closed) return;
        try {
          const buffer = Buffer.alloc(Math.min(64 * 1024, end - position + 1));
          const { bytesRead } = await file.read(buffer, 0, buffer.length, position);
          if (closed) return;
          if (bytesRead) { position += bytesRead; controller.enqueue(buffer.subarray(0, bytesRead)); }
          if (!bytesRead || position > end) { closed = true; controller.close(); await file.close().catch(() => {}); }
        } catch (error) {
          if (!closed) { closed = true; controller.error(error); await file.close().catch(() => {}); }
        }
      },
      async cancel() { if (!closed) { closed = true; await file.close().catch(() => {}); } },
    });
    return new Response(stream, { status: range ? 206 : 200, headers });
  } catch { return new Response(null, { status: 404 }); }
}
