import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { uploadImage } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Authenticated image upload used by dashboard image pickers. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  const folder = String(formData.get("folder") ?? "uploads");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  try {
    const url = await uploadImage(file, folder);
    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 400 });
  }
}
