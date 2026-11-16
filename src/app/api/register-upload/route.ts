import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/auth";
import { uploadImage, uploadVerificationDocument } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  const limit = rateLimit(`register-upload:${ip}`, 25, 10 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many file uploads. Please wait a minute and try again." },
      { status: 429 },
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const kind = String(formData.get("kind") ?? "kyc").trim();

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "No file received" }, { status: 400 });
    }

    let url: string;
    if (kind === "logo") {
      url = await uploadImage(file, "stores/logos");
    } else if (kind === "cover") {
      url = await uploadImage(file, "stores/covers");
    } else {
      url = await uploadVerificationDocument(file, "vendor-kyc");
    }

    return NextResponse.json({ url, filename: file.name });
  } catch (err) {
    const message = err instanceof Error ? err.message : "File upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
