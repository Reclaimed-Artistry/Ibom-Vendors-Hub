import { processRefund } from "../src/lib/payments";
import assert from "node:assert/strict";
import { withSystem } from "../src/lib/db";
import { createCheckout } from "../src/lib/orders";
import { payWithWalletCheckout } from "../src/lib/wallet-payments";
import { checkoutSchema } from "../src/lib/validation";

async function main() {
  assert(!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("127.0.0.1"));
  delete process.env.SMTP_HOST;
  const rollback = new Error("rollback");
  try { await withSystem(async (db) => {
    const customer = await db.one<{ id: string; email: string; fullName: string }>(`select id,email,full_name as "fullName" from users where role='customer' limit 1`);
    const product = await db.one<{ id: string; store_id: string; owner_id: string }>(`select p.id,p.store_id,s.owner_id from products p join stores s on s.id=p.store_id where p.kind='product' and s.status='active' limit 1`);
    await db.execute(`update vendor_profiles set bank_name='Test Bank',account_name='Test Vendor',account_number='0123456789' where user_id=$1`, [product.owner_id]);
    await db.execute(`update stores set status='active',manual_suspension=false,visibility='public',accepts_orders=true,accepts_delivery=true,access_until=now()+interval '1 day',minimum_order=0 where id=$1`,[product.store_id]);
    await db.execute(`update products set is_available=true,track_stock=false where id=$1`,[product.id]);
    const input = checkoutSchema.parse({items:[{productId:product.id,quantity:1}],customerName:customer.fullName,customerEmail:customer.email,customerPhone:'08031234567',bioAddress:'10 Test Road',fulfilmentType:'delivery',address:'10 Test Road',city:'Uyo',state:'Akwa Ibom'});
    const result = await createCheckout(input, customer, 'bank_transfer');
    assert(result.authorizationUrl.startsWith('/pay/'));
    assert.equal((await db.one(`select count(*)::int n from manual_order_payments where payment_id=(select id from payments where reference=$1)`,[result.paymentReference])).n,1);
    const walletCheckout = await createCheckout(input, customer, 'wallet');
    await db.execute(`insert into wallets(user_id,balance) values($1,1000000) on conflict(user_id) do update set balance=1000000`,[customer.id]);
    await assert.rejects(payWithWalletCheckout({userId:product.owner_id,email:customer.email,checkoutReference:walletCheckout.checkoutReference,grandTotal:1}), /not found/);
    await payWithWalletCheckout({userId:customer.id,email:customer.email,checkoutReference:walletCheckout.checkoutReference,grandTotal:1});
    const balance = Number((await db.one(`select balance from wallets where user_id=$1`,[customer.id])).balance);
    assert.equal(balance,1000000-walletCheckout.total,'server total overrides forged browser total');
    await payWithWalletCheckout({userId:customer.id,email:customer.email,checkoutReference:walletCheckout.checkoutReference,grandTotal:1});
    assert.equal(Number((await db.one(`select balance from wallets where user_id=$1`,[customer.id])).balance),balance,'retry never double debits');
    assert.equal((await db.one(`select status from payments where reference=$1`,[walletCheckout.paymentReference])).status,'success');
    await assert.rejects(payWithWalletCheckout({userId:customer.id,email:customer.email,checkoutReference:result.checkoutReference,grandTotal:1}), /not found/);
    const admin = await db.one<{ id: string }>(`select id from users where role in ('admin','super_admin') limit 1`);
    const refund = await db.one<{ id: string }>(`insert into refunds(payment_id,order_id,store_id,amount,reason,status,requested_by) select p.id,o.id,o.store_id,o.total,'Regression refund','requested',$2 from payments p join orders o on o.checkout_reference=p.checkout_reference where p.reference=$1 returning id`,[walletCheckout.paymentReference,admin.id]);
    await processRefund(refund.id,admin.id,true);
    assert.equal(Number((await db.one(`select balance from wallets where user_id=$1`,[customer.id])).balance),1000000,'refund credits the original wallet');
    await processRefund(refund.id,admin.id,true);
    assert.equal(Number((await db.one(`select balance from wallets where user_id=$1`,[customer.id])).balance),1000000,'refund retry never double credits');
    console.log('Actual checkout regression passed: bank transfer, wallet creation/payment, amount tampering, ownership, idempotency and cross-provider isolation');
    throw rollback;
  }); } catch(error) { if(error !== rollback) throw error; }
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>setTimeout(()=>process.exit(process.exitCode??0),50));
