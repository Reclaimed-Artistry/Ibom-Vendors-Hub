import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  let body: {
    items: Array<{ productId: string; name: string; quantity: number; price: number }>;
    subtotal: number;
    checkoutReference?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "No cart items" }, { status: 400 });
  }

  try {
    await systemDb.execute(
      `insert into abandoned_carts
         (user_id, customer_email, customer_name, items_json, subtotal, checkout_reference)
       values ($1, $2, $3, $4::jsonb, $5, $6)`,
      [
        user.id,
        user.email,
        user.fullName,
        JSON.stringify(body.items),
        Number(body.subtotal || 0),
        body.checkoutReference ?? null,
      ],
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to record cart" },
      { status: 500 },
    );
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const isAdmin = user.role === "admin" || user.role === "super_admin";

  let rows;
  if (isAdmin) {
    rows = await systemDb.query<{
      id: string;
      customer_email: string;
      customer_name: string;
      items_json: any;
      subtotal: number;
      currency: string;
      checkout_reference: string | null;
      recovered_at: string | null;
      recovery_sent: boolean;
      created_at: string;
    }>(
      `select id, customer_email, customer_name, items_json, subtotal, currency,
              checkout_reference, recovered_at, recovery_sent, created_at
         from abandoned_carts
        order by created_at desc limit 100`,
    );
  } else {
    rows = await systemDb.query<{
      id: string;
      customer_email: string;
      customer_name: string;
      items_json: any;
      subtotal: number;
      currency: string;
      checkout_reference: string | null;
      recovered_at: string | null;
      recovery_sent: boolean;
      created_at: string;
    }>(
      `select id, customer_email, customer_name, items_json, subtotal, currency,
              checkout_reference, recovered_at, recovery_sent, created_at
         from abandoned_carts
        where user_id = $1
        order by created_at desc limit 50`,
      [user.id],
    );
  }

  return NextResponse.json({ carts: rows });
}
