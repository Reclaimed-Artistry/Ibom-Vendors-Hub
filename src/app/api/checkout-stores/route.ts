import { NextResponse } from "next/server";
import { systemDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawSlugs = searchParams.get("slugs") ?? "";
  const rawProducts = searchParams.get("productIds") ?? "";

  const slugs = [...new Set(rawSlugs.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 20);
  const productIds = [
    ...new Set(
      rawProducts
        .split(",")
        .map((id) => id.trim())
        .filter((id) => UUID_RE.test(id)),
    ),
  ].slice(0, 50);

  const [stores, validProducts] = await Promise.all([
    slugs.length === 0
      ? Promise.resolve([])
      : systemDb.query<{
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
            where slug = any($1::text[])
              and store_is_live(id)`,
          [slugs],
        ),
    productIds.length === 0
      ? Promise.resolve([])
      : systemDb.query<{ id: string; delivery_fee: number | null }>(
          `select p.id, p.delivery_fee
             from products p
            where p.id = any($1::uuid[])
              and p.is_available = true
              and store_is_live(p.store_id)`,
          [productIds],
        ),
  ]);

  return NextResponse.json({
    stores,
    productDeliveryFees: Object.fromEntries(validProducts.map((p) => [p.id, p.delivery_fee])),
    validProductIds: validProducts.map((p) => p.id),
  });
}
