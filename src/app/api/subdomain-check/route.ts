import { NextRequest, NextResponse } from "next/server";
import { resolveAvailableSubdomain } from "@/lib/stores";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim() ?? "";
  const city = req.nextUrl.searchParams.get("city")?.trim() ?? "Uyo";

  if (!name || name.length < 2) {
    return NextResponse.json({
      available: false,
      slug: "",
      reason: "Enter at least 2 characters for your business name",
    });
  }

  try {
    const result = await resolveAvailableSubdomain(name, city);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[subdomain-check] Error:", err);
    return NextResponse.json(
      { available: false, slug: "", reason: "Could not verify address right now" },
      { status: 500 },
    );
  }
}
