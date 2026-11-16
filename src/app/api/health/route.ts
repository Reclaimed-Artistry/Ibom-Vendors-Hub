import { NextRequest, NextResponse } from "next/server";
import { databaseHealthy, systemDb } from "@/lib/db";
import { gatewayStatus, getSettings } from "@/lib/settings";
import { googleConfigured } from "@/lib/google-auth";
import { pruneOrphanStoreProductFiles } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Counts what is live on the ticker — a number, never the message text. */
async function liveAnnouncements(): Promise<{ total: number; vendors: number; customers: number } | null> {
  try {
    const row = await systemDb.maybeOne<{ total: number; vendors: number; customers: number }>(
      `select count(*)::int as total,
              count(*) filter (where audience in ('vendors','everyone'))::int as vendors,
              count(*) filter (where audience in ('customers','everyone'))::int as customers
         from announcements
        where is_active and starts_at <= now() and (ends_at is null or ends_at > now())`,
    );
    return row ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const database = await databaseHealthy();
  if (database && request.nextUrl.searchParams.get("pruneOrphans") === "1") {
    try {
      const stores = await systemDb.query<{ id: string; slug: string }>(`select id, slug from stores`);
      for (const s of stores) {
        const imgs = await systemDb.query<{ url: string }>(
          `select pi.url from product_images pi join products p on p.id = pi.product_id where p.store_id = $1`,
          [s.id],
        );
        await pruneOrphanStoreProductFiles(s.slug, imgs.map((r) => r.url));
      }
    } catch {
      /* non-fatal */
    }
  }
  const settings = await getSettings();
  const gateway = gatewayStatus(settings);
  return NextResponse.json(
    {
      status: database ? "ok" : "degraded",
      database,
      platform: "Ibom Vendors Hub",
      // Operational facts only — never the keys themselves.
      payments: {
        mode: gateway.mode,
        publicKey: gateway.publicConfigured,
        secretKey: gateway.secretConfigured,
        keyKind: gateway.secretKind === "missing" ? gateway.publicKind : gateway.secretKind,
        warnings: gateway.warnings.length,
      },
      signIn: {
        google: (await googleConfigured()) ? "live" : settings.google_signin_enabled ? "unconfigured" : "off",
      },
      announcements: await liveAnnouncements(),
      time: new Date().toISOString(),
    },
    { status: database ? 200 : 503 },
  );
}
