import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { withSystem } from "../src/lib/db";
import { parseOrderTiming, formatNigeriaTime, setOrderTiming } from "../src/lib/order-timing";

async function main() {
  assert(!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("127.0.0.1"), "Local database only");
  delete process.env.SMTP_HOST;
  const now = Date.UTC(2026, 0, 1);
  assert.equal(parseOrderTiming("2026-01-02T14:30", now), "2026-01-02T13:30:00.000Z");
  for (const time of ["2025-01-01T10:00", "2026-02-30T10:00", "2026-01-02T25:00", "not-a-date"]) assert.throws(() => parseOrderTiming(time, now));
  assert(formatNigeriaTime("2026-01-02T13:30:00Z").includes("WAT"));
  const rollback = new Error("rollback");
  try { await withSystem(async (db) => {
    const original = await db.one<{id:string;owner_id:string}>(`select o.id,s.owner_id from orders o join stores s on s.id=o.store_id where o.customer_id is not null limit 1`);
    const localTime = new Date(Date.now()+86400000+3600000).toISOString().slice(0,16);
    for (const fulfilment of ["delivery", "pickup"]) {
      const id = randomUUID();
      await db.execute(`insert into orders select (jsonb_populate_record(null::orders,to_jsonb(o)||$2::jsonb)).* from orders o where o.id=$1`,[original.id,JSON.stringify({id,reference:`TIME-${id}`,status:"placed",fulfilment_type:fulfilment,fulfilment_expected_at:null,fulfilment_timing_note:null})]);
      await assert.rejects(setOrderTiming(randomUUID(),id,localTime,"Test"), /not found/);
      const result = await setOrderTiming(original.owner_id,id,localTime,"Please call on arrival");
      assert(result.changed);
      assert(result.message.includes(fulfilment === "pickup" ? "Pickup-ready" : "arrival at your location"));
      const saved = await db.one(`select fulfilment_expected_at,fulfilment_timing_note,status from orders where id=$1`,[id]);
      assert(saved.fulfilment_expected_at);assert.equal(saved.fulfilment_timing_note,"Please call on arrival");assert.equal(saved.status,"placed");
      assert.equal((await setOrderTiming(original.owner_id,id,localTime,"Please call on arrival")).changed,false);
      const email = await db.one(`select text from email_logs where template='order_fulfilment_time' and payload->>'orderReference'=$1`,[`TIME-${id}`]);assert(email.text.includes("Please call on arrival"));
      const notification = await db.one(`select body from notifications where action_url=$1 and type='order_fulfilment_time'`,[`/account/orders/${id}`]);assert(notification.body.includes("WAT"));
      await db.execute(`update orders set status='completed' where id=$1`,[id]);
      await assert.rejects(setOrderTiming(original.owner_id,id,localTime,"Change"),/closed/);
    }
    console.log("Order timing tests passed: delivery/pickup, WAT conversion, date validation, ownership, persistence, customer email/notification, unchanged order status, deduplication and closed-order protection.");
    throw rollback;
  }); } catch (error) { if(error!==rollback) throw error; }
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>setTimeout(()=>process.exit(process.exitCode??0),50));
