/** Local-only regression: every fixture and side effect is rolled back. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { withSystem } from "../src/lib/db";
import { receiptMime, submitManualReceipt, reviewManualTransfer } from "../src/lib/manual-payments";
import { markPaymentSuccessful } from "../src/lib/payments";

async function main() {
  assert(!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("127.0.0.1"), "Run only against the local database");
  delete process.env.SMTP_HOST;
  const rollback = new Error("rollback-test");
  try { await withSystem(async (db) => {
    const original = await db.one<{ id: string; store_id: string; customer_id: string; owner_id: string }>(`select o.id, o.store_id, o.customer_id, s.owner_id from orders o join stores s on s.id=o.store_id where o.customer_id is not null limit 1`);
    const customer = original.customer_id;
    const orderId = randomUUID(), paymentId = randomUUID(), transferId = randomUUID();
    const reference = `TEST-${randomUUID()}`;
    await db.execute(`insert into orders select (jsonb_populate_record(null::orders, to_jsonb(o) || $2::jsonb)).* from orders o where o.id=$1`, [original.id, JSON.stringify({ id: orderId, reference, checkout_reference: reference, payment_status: "pending", status: "placed", amount_paid: 0, stock_committed: false, platform_commission: 0, vendor_payable: 0 })]);
    await db.execute(`insert into payments (id,reference,scope,provider,checkout_reference,payer_user_id,payer_email,amount,currency,status) select $1,$2,'order','manual',$2,customer_id,customer_email,total,currency,'pending' from orders where id=$3`, [paymentId, reference, orderId]);
    await db.execute(`insert into manual_order_payments (id,order_id,payment_id,customer_id,store_id,bank_name,account_name,account_number,amount) select $1,id,$2,customer_id,store_id,'Test Bank','Test Vendor','0123456789',total from orders where id=$3`, [transferId, paymentId, orderId]);
    assert.equal(receiptMime(Buffer.from("%PDF-1.7 test")), "application/pdf");
    assert.equal(receiptMime(Buffer.from([255,216,255,0])), "image/jpeg");
    assert.throws(() => receiptMime(Buffer.from("<script>bad</script>")));
    assert.throws(() => receiptMime(Buffer.alloc(2 * 1024 * 1024 + 1)));
    await assert.rejects(markPaymentSuccessful(reference, { via: "manual" }), /individually/);
    await assert.rejects(submitManualReceipt(randomUUID(), transferId, Buffer.from("%PDF-1.7")), /not yours/);
    await submitManualReceipt(customer, transferId, Buffer.from("%PDF-1.7"));
    assert.equal((await db.one(`select status from manual_order_payments where id=$1`, [transferId])).status, "awaiting_approval");
    await assert.rejects(reviewManualTransfer(customer, transferId, "approve", ""), /not assigned/);
    await reviewManualTransfer(original.owner_id, transferId, "reject", "Wrong transaction");
    await submitManualReceipt(customer, transferId, Buffer.from("%PDF-1.7 corrected"));
    const before = await db.query(`select * from vendor_balances where store_id=$1`, [original.store_id]);
    const secondOrder = randomUUID(), secondTransfer = randomUUID();
    await db.execute(`insert into orders select (jsonb_populate_record(null::orders, to_jsonb(o) || $2::jsonb)).* from orders o where o.id=$1`, [orderId, JSON.stringify({ id: secondOrder, reference: `${reference}-2` })]);
    await db.execute(`insert into manual_order_payments (id,order_id,payment_id,customer_id,store_id,bank_name,account_name,account_number,amount) select $1,id,$2,customer_id,store_id,'Test Bank','Test Vendor','0123456789',total from orders where id=$3`, [secondTransfer, paymentId, secondOrder]);
    await reviewManualTransfer(original.owner_id, transferId, "approve", "Verified bank credit");
    assert.equal((await db.one(`select status from payments where id=$1`, [paymentId])).status, "pending", "checkout remains pending until every vendor approves");
    assert.equal((await db.one(`select payment_status from orders where id=$1`, [secondOrder])).payment_status, "pending", "approval never marks a different order paid");
    await submitManualReceipt(customer, secondTransfer, Buffer.from("%PDF-1.7 second"));
    await reviewManualTransfer(original.owner_id, secondTransfer, "approve", "Verified");
    assert.equal((await db.one(`select status from payments where id=$1`, [paymentId])).status, "success");
    assert.equal((await db.one(`select payment_status from orders where id=$1`, [orderId])).payment_status, "paid");
    assert.deepEqual(await db.query(`select * from vendor_balances where store_id=$1`, [original.store_id]), before);
    assert.equal(Number((await db.one(`select count(*) as n from platform_commissions where order_id=$1`, [orderId])).n), 0);
    assert.equal((await reviewManualTransfer(original.owner_id, transferId, "approve", "")).changed, false);
    await db.execute("savepoint private_receipt");
    await db.execute("set local role app_runtime");
    await assert.rejects(db.query("select receipt_data from manual_order_payments"), /permission denied/);
    await db.execute("rollback to savepoint private_receipt");
    console.log("Manual payment regression passed: private receipts, MIME/size, ownership, bypass prevention, submission, rejection/resubmission, approval, idempotency and zero escrow accrual.");
    throw rollback;
  }); } catch (error) { if (error !== rollback) throw error; }
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 50); });
