import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { withSystem } from "../src/lib/db";
import { getMarketplaceHighlights, searchMarketplace } from "../src/lib/storefront";

async function main() {
  assert(!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("127.0.0.1"), "Local fixtures only");
  const rollback = new Error("rollback fixtures");
  try { await withSystem(async db => {
    const owner = await db.one<{owner_id:string}>("select owner_id from stores limit 1");
    const ids: string[] = [];
    const listingIds: string[] = [];
    for (let i=0;i<12;i++) {
      const id=randomUUID(); ids.push(id);
      await db.execute(`insert into stores(id,owner_id,name,slug,email,phone,city,state,status,visibility,manual_suspension,is_featured)
        values($1,$2,$3,$4,'test@example.test','08012345678','Uyo','Akwa Ibom','active','public',false,false)`,[id,owner.owner_id,`Feature fixture ${i}`,`feature-${id}`]);
      for (let j=0;j<6;j++) {
        const pid=randomUUID();listingIds.push(pid);
        await db.execute(`insert into products(id,store_id,name,slug,kind,price,is_available) values($1,$2,'Feature listing',$3,$4,1000,true)`,[pid,id,`feature-${pid}`,j%2?'service':'product']);
      }
    }
    const highlights=await getMarketplaceHighlights();
    for(const id of ids) assert(highlights.featured.some(s=>s.id===id),"Every approved store featured, not just first 8");
    const products=await searchMarketplace({showcaseAll:true});
    for(const id of listingIds) assert(products.products.some(p=>p.id===id),"All products and services included beyond 60");
    assert(products.products.some(p=>p.kind==='service'));
    for(const [status,manual,visibility] of [['pending',false,'public'],['active',true,'public'],['active',false,'unlisted'],['rejected',false,'public']]) {
      await db.execute("update stores set status=$2,manual_suspension=$3,visibility=$4 where id=$1",[ids[0],status,manual,visibility]);
      assert(!(await getMarketplaceHighlights()).featured.some(s=>s.id===ids[0]));
      assert(!(await searchMarketplace({showcaseAll:true})).products.some(p=>p.store_id===ids[0]));
    }
    await db.execute("update products set is_available=false where id=$1",[listingIds[6]]);
    assert(!(await searchMarketplace({showcaseAll:true})).products.some(p=>p.id===listingIds[6]));
    assert((await searchMarketplace({limit:8})).products.length<=8,"Browse pagination preserved");
    console.log("PASS: 12 unflagged approved stores, 72 products/services, unavailable and non-live exclusions, browse pagination");
    throw rollback;
  }); } catch(e) {if(e!==rollback)throw e;}
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>setTimeout(()=>process.exit(process.exitCode??0),50));
