/** Rebuild a fresh in-memory pre-feature database, then test the 0030 backfill. */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

async function main() {
  const db = await PGlite.create();
  try {
    const dir="supabase/migrations";
    const migration="0030_multi_category_stores.sql";
    for(const filename of readdirSync(dir).filter(file=>file.endsWith(".sql")&&file<migration).sort()) await db.exec(readFileSync(`${dir}/${filename}`,"utf8"));
    const owner=randomUUID(),store=randomUUID(),uncategorisedStore=randomUUID(),section=randomUUID(),product=randomUUID(),uncategorisedProduct=randomUUID();
    const category=(await db.query<{id:string}>(`select id from store_categories where slug='fashion-clothing'`)).rows[0].id;
    await db.query(`insert into users(id,email,full_name,role) values($1,'migration-fixture@example.test','Migration Fixture','vendor')`,[owner]);
    await db.query(`insert into stores(id,owner_id,category_id,name,slug,city,state) values($1,$2,$3,'Categorised fixture','categorised-fixture','Uyo','Akwa Ibom')`,[store,owner,category]);
    await db.query(`insert into stores(id,owner_id,name,slug,city,state) values($1,$2,'Uncategorised fixture','uncategorised-fixture','Uyo','Akwa Ibom')`,[uncategorisedStore,owner]);
    await db.query(`insert into product_categories(id,store_id,name,slug) values($1,$2,'My dresses','my-dresses')`,[section,store]);
    await db.query(`insert into products(id,store_id,category_id,name,slug,price,attributes) values($1,$2,$3,'Existing dress','existing-dress',9500,'{"size":"Large"}'::jsonb)`,[product,store,section]);
    await db.query(`insert into products(id,store_id,name,slug,price) values($1,$2,'Existing uncategorised item','existing-uncategorised-item',500)`,[uncategorisedProduct,uncategorisedStore]);
    await db.query(`insert into product_variants(product_id,name,price) values($1,'Large',9500)`,[product]);
    await db.query(`insert into product_images(product_id,url) values($1,'/images/seed/product-jollof.svg')`,[product]);
    const order=(await db.query<{id:string}>(`insert into orders(checkout_reference,store_id,customer_name,customer_email,customer_phone) values('migration-test',$1,'Migration Customer','customer@example.test','08031234567') returning id`,[store])).rows[0].id;
    await db.query(`insert into order_items(order_id,product_id,name) values($1,$2,'Existing dress'),($1,null,'Custom quotation')`,[order,product]);
    await db.exec(readFileSync(`${dir}/${migration}`,"utf8"));
    assert((await db.query<{marketplace_category_id:string}>(`select marketplace_category_id from order_items where order_id=$1`,[order])).rows.every(row=>row.marketplace_category_id===category),"old purchase and quotation lines retain their inherited category");
    const old=(await db.query<{category_id:string;marketplace_category_id:string;price:number;attributes:Record<string,string>}>(`select * from products where id=$1`,[product])).rows[0];
    assert.equal(old.category_id,section,"private catalogue section unchanged");
    assert.equal(old.marketplace_category_id,category,"old product receives the store category it inherited before the migration");
    assert.equal(Number(old.price),9500);assert.equal(old.attributes.size,"Large");
    assert.equal((await db.query(`select * from product_variants where product_id=$1`,[product])).rows.length,1);
    assert.equal((await db.query(`select * from product_images where product_id=$1`,[product])).rows.length,1);
    assert.equal((await db.query<{category_id:string}>(`select category_id from store_category_assignments where store_id=$1`,[store])).rows[0].category_id,category);
    assert.equal((await db.query(`select * from store_category_assignments where store_id=$1`,[uncategorisedStore])).rows.length,0);
    assert.equal((await db.query<{marketplace_category_id:null}>(`select marketplace_category_id from products where id=$1`,[uncategorisedProduct])).rows[0].marketplace_category_id,null);
    await db.query(`insert into products(store_id,name,slug,price) values($1,'Legacy client insert','legacy-client-insert',100)`,[store]);
    assert.equal((await db.query<{marketplace_category_id:string}>(`select marketplace_category_id from products where slug='legacy-client-insert'`)).rows[0].marketplace_category_id,category);
    console.log("PASS: fresh migration chain and 0030 backfill preserve stores, primary categories, uncategorised data, catalogue sections, attributes, prices, images and variants; legacy insert defaults work");
  } finally {await db.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
