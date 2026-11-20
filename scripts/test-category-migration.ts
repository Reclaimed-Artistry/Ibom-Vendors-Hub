/** Fresh migration chain, 0030 backfill and additive/idempotent 0032 household taxonomy. */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { EXPANDED_CATEGORIES } from "../src/lib/expanded-categories";

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

    const householdMigration="0032_household_products_category.sql";
    for(const filename of readdirSync(dir).filter(file=>file.endsWith(".sql")&&file>migration&&file<householdMigration).sort()) await db.exec(readFileSync(`${dir}/${filename}`,"utf8"));
    const previousCategories=(await db.query(`select * from store_categories order by slug`)).rows;
    const snapshot=async()=>{
      const data:Record<string,unknown>={};
      for(const table of ["stores","products","product_categories","product_images","product_variants","orders","order_items"]) data[table]=(await db.query(`select * from ${table} order by id`)).rows;
      data.assignments=(await db.query(`select * from store_category_assignments order by store_id,category_id`)).rows;
      return data;
    };
    const before=await snapshot();
    const sql=readFileSync(`${dir}/${householdMigration}`,"utf8");
    await db.exec(sql);
    const household=(await db.query<{id:string;slug:string;name:string;description:string;icon:string;features:Record<string,boolean>;sort_order:number;is_active:boolean}>(`select * from store_categories where slug='household-products'`)).rows[0];
    assert(household);
    const definition=EXPANDED_CATEGORIES[household.slug];
    for(const key of ["name","description","icon","features"] as const) assert.deepEqual(household[key],definition[key],key);
    assert.equal(household.sort_order,28);assert.equal(household.is_active,true);
    assert.equal((await db.query(`select * from store_categories`)).rows.length,previousCategories.length+1);
    await db.exec(sql);
    const replayed=(await db.query<{id:string}>(`select id from store_categories where slug='household-products'`)).rows;
    assert.deepEqual(replayed,[{id:household.id}],"replay retains the same household category ID and does not duplicate it");
    assert.deepEqual((await db.query(`select * from store_categories where slug<>'household-products' order by slug`)).rows,previousCategories,"existing category settings are untouched");
    assert.deepEqual(await snapshot(),before,"no inventory, recategorisation or changes to existing stores, media, sections, variants or orders");
    console.log("PASS: fresh chain through 0032, household definition/retail parity, stable category on replay and no invented stock or changes to existing data");
  } finally {await db.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
