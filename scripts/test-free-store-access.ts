import assert from "node:assert/strict";
import { Client } from "pg";
const db = new Client({ connectionString: process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5544/postgres" });
async function main() {
  await db.connect();
  await db.query("begin");
  try {
    const { rows: [store] } = await db.query("select id from stores limit 1");
    assert.ok(store, "A local fixture store is required");
    await db.query("update subscriptions set expires_at=now()-interval '1 day' where store_id=$1", [store.id]);
    for (const [status, manual, visibility, access, live] of [
      ["active", false, "public", true, true],
      ["pending", false, "public", true, false],
      ["suspended", true, "public", false, false],
      ["rejected", false, "public", false, false],
      ["active", false, "unlisted", true, false],
    ]) {
      await db.query("update stores set status=$2, manual_suspension=$3, visibility=$4, access_until=now()-interval '1 day' where id=$1", [store.id,status,manual,visibility]);
      const { rows: [result] } = await db.query("select store_has_vendor_access($1) as access, store_is_live($1) as live", [store.id]);
      assert.equal(result.access, access); assert.equal(result.live, live);
    }
    assert.equal((await db.query("select * from process_subscription_expiry()")).rowCount, 0);
    console.log("PASS: free access without subscription, pending/private visibility, manual suspension, rejection, and paused expiry");
  } finally { await db.query("rollback"); await db.end(); }
}
main().catch(e => { console.error(e); process.exitCode=1; });
