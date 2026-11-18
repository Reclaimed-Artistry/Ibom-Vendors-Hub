import { NextResponse } from "next/server";
import { authContinueUrl } from "@/lib/auth-navigation";

export const dynamic = "force-dynamic";
/** Return to the original cart origin after Google's canonical callback. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const response = NextResponse.redirect(authContinueUrl(params.get("store"), params.get("next")));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
