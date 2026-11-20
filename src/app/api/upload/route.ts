import { NextResponse } from "next/server";
import { getCurrentUser, getVendorContext, vendorSuspensionMessage } from "@/lib/auth";
import { uploadImage, uploadVerificationDocument } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Authenticated file upload used by dashboard pickers (images & vendor KYC docs). */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  const rawFolder = String(formData.get("folder") ?? "uploads").trim();
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  let targetFolder = rawFolder;
  if (user.role === "vendor") {
    const ctx = await getVendorContext();
    if (ctx.isSubscriptionExpired || ctx.isManuallySuspended) {
      return NextResponse.json(
        { error: vendorSuspensionMessage(ctx) ?? "Account suspended." },
        { status: 403 },
      );
    }
    if (ctx.store.status === "rejected" && rawFolder !== "vendor-kyc") {
      return NextResponse.json(
        { error: vendorSuspensionMessage(ctx) ?? "Storefront application declined." },
        { status: 403 },
      );
    }
    if (rawFolder === "products" || rawFolder === "branding" || rawFolder === "uploads") {
      targetFolder = `stores/${ctx.store.slug}/${rawFolder}`;
    }
  }

  try {
    const url =
      rawFolder === "vendor-kyc"
        ? await uploadVerificationDocument(file, "vendor-kyc")
        : await uploadImage(file, targetFolder);
    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
