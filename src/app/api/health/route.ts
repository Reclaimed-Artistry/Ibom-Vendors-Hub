import { NextResponse } from "next/server";
import { databaseHealthy } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const database = await databaseHealthy();
  return NextResponse.json(
    {
      status: database ? "ok" : "degraded",
      database,
      platform: "Ibom Vendors Hub",
      time: new Date().toISOString(),
    },
    { status: database ? 200 : 503 },
  );
}
