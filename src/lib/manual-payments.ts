import { systemDb, withSystem } from "@/lib/db";
import { markOrdersPaid } from "@/lib/orders";
import { notify } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { url } from "@/lib/settings";
import { logActivity } from "@/lib/audit";

export interface ManualTransfer {
  id: string; order_id: string; payment_id: string; customer_id: string; store_id: string;
  bank_name: string; account_name: string; account_number: string; amount: number;
  status: "awaiting_transfer" | "awaiting_approval" | "approved" | "rejected";
  expires_at: string; submitted_at: string | null; review_note: string | null;
  order_reference: string; store_name: string; customer_name: string; payment_reference: string;
}
export const transferSelect = `select m.id, m.order_id, m.payment_id, m.customer_id, m.store_id,
 m.bank_name, m.account_name, m.account_number, m.amount, m.status, m.expires_at::text, m.submitted_at::text, m.review_note,
 o.reference as order_reference, o.customer_name, s.name as store_name, p.reference as payment_reference
 from manual_order_payments m join orders o on o.id = m.order_id join stores s on s.id = m.store_id join payments p on p.id = m.payment_id`;

export function receiptMime(bytes: Buffer): string {
  if (!bytes.length || bytes.length > 2 * 1024 * 1024) throw new Error("Receipt must be no larger than 2 MB.");
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  throw new Error("Upload a PNG, JPEG or PDF receipt.");
}

export async function submitManualReceipt(userId: string, transferId: string, bytes: Buffer) {
  const mime = receiptMime(bytes);
  const result = await withSystem(async (db) => {
    const row = await db.maybeOne<ManualTransfer & { order_status: string }>(`${transferSelect.replace("select m.id", "select o.status as order_status, m.id")} where m.id = $1 and m.customer_id = $2 for update of m`, [transferId, userId]);
    if (!row) throw new Error("Payment not found or not yours.");
    if (["cancelled", "rejected"].includes(row.order_status)) throw new Error("This order is closed. Contact the vendor if you already transferred money.");
    if (row.status === "approved" || row.status === "awaiting_approval") return { row, changed: false };
    await db.execute(`update manual_order_payments set receipt_data=$2, receipt_type=$3, submitted_at=now(), status='awaiting_approval', review_note=null where id=$1`, [row.id, bytes.toString("base64"), mime]);
    await logActivity({ actorId: userId, actorRole: "customer", storeId: row.store_id, action: "manual_payment.receipt_submitted", entityType: "order", entityId: row.order_id, description: `Receipt submitted for ${row.order_reference}` }, db);
    return { row, changed: true };
  });
  if (result.changed) {
    const owner = await systemDb.one<{ owner_id: string; email: string }>(`select s.owner_id, u.email from stores s join users u on u.id=s.owner_id where s.id=$1`, [result.row.store_id]);
    await notify({ userId: owner.owner_id, storeId: result.row.store_id, type: "manual_payment_review", title: `Payment approval needed · ${result.row.order_reference}`, body: "A customer uploaded a bank-transfer receipt. Verify the credit in your bank account before approving.", actionUrl: "/vendor/payment-approvals" });
    await sendEmail({ to: owner.email, template: "manual_payment_review", data: { storeName: result.row.store_name, orderReference: result.row.order_reference, amount: result.row.amount, link: url("/vendor/payment-approvals") } });
  }
  return result.row;
}

export async function reviewManualTransfer(ownerId: string, transferId: string, decision: "approve" | "reject", note: string) {
  const outcome = await withSystem(async (db) => {
    // Lock the checkout first, serializing concurrent approvals across vendors.
    const parent = await db.maybeOne<{ id: string; checkout_reference: string }>(`select p.id, p.checkout_reference from payments p join manual_order_payments m on m.payment_id=p.id join stores s on s.id=m.store_id where m.id=$1 and s.owner_id=$2 and p.provider='manual' for update of p`, [transferId, ownerId]);
    if (!parent) throw new Error("Payment not found or not assigned to your store.");
    const row = await db.one<ManualTransfer>(`${transferSelect} where m.id=$1 for update of m`, [transferId]);
    if (row.status === "approved") return { row, changed: false };
    if (row.status !== "awaiting_approval") throw new Error("This payment is not awaiting approval.");
    const order = await db.one<{ status: string; payment_status: string }>(`select status, payment_status from orders where id=$1 for update`, [row.order_id]);
    if (["cancelled", "rejected"].includes(order.status)) throw new Error("The order is closed. Resolve the transfer with the customer before proceeding.");
    if (order.payment_status === "paid") throw new Error("This order has already been paid through another method.");
    await db.execute(`update manual_order_payments set status=$2, reviewed_at=now(), reviewed_by=$3, review_note=$4 where id=$1`, [row.id, decision === "approve" ? "approved" : "rejected", ownerId, note || null]);
    if (decision === "approve") {
      await db.execute(`update orders set platform_commission=0, vendor_payable=0 where id=$1`, [row.order_id]);
      await markOrdersPaid(db, parent.checkout_reference, parent.id, "bank_transfer_direct", row.order_id);
      await db.execute(`update payments set status='success', channel='bank_transfer_direct', paid_at=now(), verified_at=now() where id=$1 and not exists (select 1 from manual_order_payments where payment_id=$1 and status <> 'approved')`, [parent.id]);
    }
    await logActivity({ actorId: ownerId, actorRole: "vendor", storeId: row.store_id, action: `manual_payment.${decision}`, entityType: "order", entityId: row.order_id, description: `Bank transfer ${decision === "approve" ? "approved" : "rejected"} for ${row.order_reference}`, meta: { note } }, db);
    return { row, changed: true };
  });
  if (outcome.changed) {
    await notify({ userId: outcome.row.customer_id, storeId: outcome.row.store_id, type: "manual_payment_reviewed", title: decision === "approve" ? "Payment approved" : "Payment receipt needs attention", body: decision === "approve" ? `Your payment for ${outcome.row.order_reference} is approved.` : note, actionUrl: `/pay/${outcome.row.payment_reference}` });
  }
  return outcome;
}
