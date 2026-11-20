import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { withSystem } from "../src/lib/db";
import { addInspectionSlot, inspectionSlots, reserveInspection, withdrawInspectionSlot, validatePropertyAttributes } from "../src/lib/property-inspections";

async function main() {
  assert(!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("127.0.0.1"), "Local database only");
  delete process.env.SMTP_HOST;
  const attributes = {listing_type:"For rent",property_type:"Flat / apartment",property_location:"Shelter Afrique, Uyo, near main gate",price_period:"Per year",inspection_fee:"5000",bedrooms:"3"};
  validatePropertyAttributes(attributes);
  assert.throws(()=>validatePropertyAttributes({...attributes,inspection_fee:"-5"}),/inspection fee/);
  assert.throws(()=>validatePropertyAttributes({...attributes,listing_type:"For sale"}),/price basis/);
  validatePropertyAttributes({...attributes,listing_type:"For sale",price_period:"Total sale price",inspection_fee:"0"});
  const rollback = new Error("rollback fixtures");
  try { await withSystem(async db => {
    const store = await db.one<{id:string;owner_id:string}>(`select id,owner_id from stores limit 1`);
    const category = await db.one<{id:string}>(`select id from store_categories where slug='house-agents-realtors'`);
    await db.execute(`update stores set category_id=$2,status='active',visibility='public',manual_suspension=false,access_until=now()+interval '30 days' where id=$1`,[store.id,category.id]);
    const customer = await db.one<{id:string;email:string;fullName:string}>(`select id,email,full_name as "fullName" from users where role='customer' and id<>$1 limit 1`,[store.owner_id]);
    const productId = randomUUID();
    await db.execute(`insert into products(id,store_id,name,slug,kind,price,is_available,attributes) values($1,$2,'Test property',$3,'service',1500000,true,$4::jsonb)`,[productId,store.id,`property-${productId}`,JSON.stringify(attributes)]);
    const local = new Date(Date.now()+3*86400000+3600000).toISOString().slice(0,16);
    await assert.rejects(addInspectionSlot(randomUUID(),productId,local,60,"office","Office in Uyo"),/not found/);
    await assert.rejects(addInspectionSlot(store.owner_id,productId,local,0,"office","Office in Uyo"),/duration/);
    const slot = await addInspectionSlot(store.owner_id,productId,local,60,"office","12 Oron Road office, Uyo");
    await assert.rejects(addInspectionSlot(store.owner_id,productId,local,60,"office","12 Oron Road office"),/overlaps/);
    assert.equal((await inspectionSlots(productId)).length,1);
    const booking = await reserveInspection(customer,slot.id,"08012345678","Please call before inspection");
    assert.equal((await inspectionSlots(productId)).length,0,"booked slots are hidden");
    const saved = await db.one(`select * from service_bookings where id=$1`,[booking.id]);
    assert.equal(saved.location,"12 Oron Road office, Uyo");
    assert.equal(saved.scheduled_time,local.slice(11,16),"WAT preserved");
    assert.equal(saved.status,"requested");
    assert(saved.booking_details.fields.some((f:{key:string;value:string})=>f.key==='inspection_fee' && f.value.includes('5,000')));
    await assert.rejects(reserveInspection(customer,slot.id,"08012345678",""),/just booked/);
    await assert.rejects(withdrawInspectionSlot(store.owner_id,slot.id),/booked/);
    await db.execute(`update service_bookings set status='cancelled' where id=$1`,[booking.id]);
    assert.equal((await inspectionSlots(productId)).length,1,"cancellation frees slot");
    await withdrawInspectionSlot(store.owner_id,slot.id);
    await assert.rejects(reserveInspection(customer,slot.id,"08012345678",""),/no longer available/);
    const later = new Date(Date.now()+4*86400000+3600000).toISOString().slice(0,16);
    const slot2 = await addInspectionSlot(store.owner_id,productId,later,45,"agreed_location","Ibom Plaza main entrance, Uyo");
    await db.execute(`update products set is_available=false where id=$1`,[productId]);
    await assert.rejects(reserveInspection(customer,slot2.id,"08012345678",""),/no longer available/);
    await db.execute(`update products set is_available=true where id=$1`,[productId]);
    await db.execute(`update stores set manual_suspension=true where id=$1`,[store.id]);
    await assert.rejects(reserveInspection(customer,slot2.id,"08012345678",""),/not accepting/);
    const emails = await db.query(`select text from email_logs where template='inspection_requested' and dedupe_key like $1`,[`%${booking.id}`]);
    assert.equal(emails.length,2,"agent and customer receive email records");
    console.log("Property inspection checks passed: rent/sale and fee validation, ownership, availability, WAT, overlap prevention, double-booking protection, meeting point/fee snapshots, customer/agent email records, cancellation, withdrawal and suspended/unavailable guards.");
    throw rollback;
  }); } catch(error) { if(error!==rollback) throw error; }
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>setTimeout(()=>process.exit(process.exitCode??0),50));
