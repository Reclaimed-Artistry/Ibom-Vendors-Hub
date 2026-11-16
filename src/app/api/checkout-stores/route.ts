import { NextResponse } from "next/server";
import { systemDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("slugs") ?? "";
  const slugs = [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 20);
  if (slugs.length === 0) {
    return NextResponse.json({ stores: [] });
  }

  const stores = await systemDb.query<{
    slug: string;
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    phone: string | null;
    accepts_delivery: boolean;
    accepts_pickup: boolean;
    delivery_fee: number;
    delivery_areas: string | null;
    prep_time_minutes: number;
  }>(
    `select slug, name, address, city, state, phone, accepts_delivery, accepts_pickup,
            delivery_fee, delivery_areas, prep_time_minutes
       from stores
      where slug = any($1::text[])`,
    [slugs],
  );

  return NextResponse.json({ stores });
}
