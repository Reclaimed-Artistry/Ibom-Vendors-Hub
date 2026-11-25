import { NextResponse } from "next/server";
import { systemDb } from "@/lib/db";

/** Known bots/crawlers are never recorded as visitor traffic. */
const BOT_UA = /bot|crawler|spider|crawl|slurp|bingbot|googlebot|facebookexternalhit|twitterbot|linkedinbot|curl|wget|postman|insomnia|http.client|headlesschrome/i;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request): Promise<NextResponse> {
  // Tracking must never delay or break navigation, so failures are swallowed.
  try {
    const body = (await req.json()) as {
      session_id?: string;
      path?: string;
      referrer?: string;
    };
    if (!body.session_id || typeof body.session_id !== "string") {
      return NextResponse.json({ error: "bad request" }, { status: 400 });
    }
    if (!body.path || typeof body.path !== "string") {
      return NextResponse.json({ error: "bad request" }, { status: 400 });
    }

    const ua = req.headers.get("user-agent") ?? "";
    if (BOT_UA.test(ua)) {
      return NextResponse.json({ ok: true });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      null;

    await systemDb.execute(
      `insert into page_visits (session_id, path, referrer, user_agent, ip)
         values ($1, $2, $3, $4, $5)`,
      [body.session_id, body.path, body.referrer ?? null, ua || null, ip],
    );
  } catch {
    // Intentionally unobserved: analytics must never affect the user journey.
  }

  return NextResponse.json({ ok: true });
}
