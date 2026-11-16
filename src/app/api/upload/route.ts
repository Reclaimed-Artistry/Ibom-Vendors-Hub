import { NextResponse } from "next/server";
import { getCurrentUser, getVendorContext, vendorSuspensionMessage } from "@/lib/auth";
import { uploadImage, uploadVerificationDocument } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Authenticated file upload used by dashboard pickers (images & vendor KYC docs). */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.role === "vendor") {
    const ctx = await getVendorContext();
    const lockError = vendorSuspensionMessage(ctx);
    if (lockError) return NextResponse.json({ error: lockError }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const folder = String(formData.get("folder") ?? "uploads");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  try {
    const url =
      folder === "vendor-kyc"
        ? await uploadVerificationDocument(file, "vendor-kyc")
        : await uploadImage(file, folder);
    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 400 });
  }
}
