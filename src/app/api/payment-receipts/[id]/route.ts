import { getCurrentUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const row = await systemDb.maybeOne<{ receipt_data: string | null; receipt_type: string | null }>(
    `select m.receipt_data, m.receipt_type from manual_order_payments m join stores s on s.id=m.store_id
     where m.id=$1 and (m.customer_id=$2 or s.owner_id=$2 or $3 in ('admin','super_admin'))`, [id, user.id, user.role],
  );
  if (!row?.receipt_data || !row.receipt_type) return new Response("Not found", { status: 404 });
  const extension = row.receipt_type === "application/pdf" ? "pdf" : row.receipt_type === "image/png" ? "png" : "jpg";
  return new Response(new Uint8Array(Buffer.from(row.receipt_data, "base64")), { headers: {
    "Content-Type": row.receipt_type,
    "Content-Disposition": `attachment; filename="payment-receipt.${extension}"`,
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  } });
}
