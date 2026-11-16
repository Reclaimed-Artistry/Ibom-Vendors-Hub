import { NextResponse } from "next/server";
import { databaseHealthy } from "@/lib/db";
import { gatewayStatus, getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const database = await databaseHealthy();
  const gateway = gatewayStatus(await getSettings());
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
      time: new Date().toISOString(),
    },
    { status: database ? 200 : 503 },
  );
}
