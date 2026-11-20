import { googleNextForHost } from "@/lib/auth-navigation";
import { NextResponse } from "next/server";
import { beginGoogleSignIn, googleConfigured } from "@/lib/google-auth";
import { appUrl } from "@/lib/domains";

export const dynamic = "force-dynamic";

/** Entry point for "Continue with Google" — redirects to Google's consent screen. */
export async function GET(request: Request) {
  if (!(await googleConfigured())) {
    return NextResponse.redirect(`${appUrl()}/login?oauth=not_configured`);
  }
  const next = new URL(request.url).searchParams.get("next");
  const url = await beginGoogleSignIn(googleNextForHost(new URL(request.url).host, next));
  return NextResponse.redirect(url);
}
