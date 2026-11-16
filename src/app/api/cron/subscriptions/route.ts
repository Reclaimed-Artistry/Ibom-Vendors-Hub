import { NextResponse } from "next/server";
import { runSubscriptionMaintenance } from "@/lib/subscriptions";
import { retryFailedEmails } from "@/lib/email";
import { databaseHealthy } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled subscription maintenance: expiry enforcement, reminders, retry of
 * failed emails. Protect with CRON_SECRET (Authorization: Bearer <secret>) —
 * Vercel Cron sends this header automatically when configured.
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const provided = header.replace(/^Bearer\s+/i, "") || request.headers.get("x-cron-secret") || "";
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await databaseHealthy())) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
  const summary = await runSubscriptionMaintenance();
  // Provider outages and unverified domains leave messages failed; retry them
  // here so a fix at Resend's end delivers the backlog without manual work.
  const emailRetry = await retryFailedEmails(30);
  return NextResponse.json({ ok: true, ...summary, emailRetry, ranAt: new Date().toISOString() });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
