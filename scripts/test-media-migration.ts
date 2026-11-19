import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

async function main() {
  const db=await PGlite.create();
  try {
    const migration="0031_vendor_listing_media.sql", dir="supabase/migrations";
    for(const filename of readdirSync(dir).filter(file=>file.endsWith(".sql")&&file<migration).sort())await db.exec(readFileSync(`${dir}/${filename}`,"utf8"));
    const user=randomUUID(),store=randomUUID(),product=randomUUID();
    await db.query(`insert into users(id,email,full_name,role) values($1,'media-migration@example.test','Media migration','vendor')`,[user]);
    await db.query(`insert into stores(id,owner_id,name,slug) values($1,$2,'Media migration','media-migration')`,[store,user]);
    await db.query(`insert into products(id,store_id,name,slug,price) values($1,$2,'Existing listing','existing-listing',1500)`,[product,store]);
    await db.query(`insert into product_images(product_id,url,sort_order) values($1,'/old-photo.gif',3)`,[product]);
    const sql=readFileSync(`${dir}/${migration}`,"utf8");
    await db.exec(sql); // Also works on local installations without storage.buckets.
    const image=(await db.query<{url:string;sort_order:number;mime_type:null;byte_size:null}>(`select * from product_images where product_id=$1`,[product])).rows[0];
    assert.equal(image.url,"/old-photo.gif");assert.equal(image.sort_order,3);assert.equal(image.mime_type,null);assert.equal(image.byte_size,null);
    await db.exec(`create schema storage; create table storage.buckets(id text primary key,file_size_limit bigint,allowed_mime_types text[],public boolean); insert into storage.buckets values('storefronts',10485760,array['image/jpeg','application/pdf'],true);`);
    await db.exec(sql); // Replay is safe, including the bucket update.
    const bucket=(await db.query<{file_size_limit:number;allowed_mime_types:string[];public:boolean}>(`select * from storage.buckets where id='storefronts'`)).rows[0];
    assert.equal(Number(bucket.file_size_limit),104857600);assert.equal(bucket.public,true);
    for(const mime of ["image/gif","image/avif","video/mp4","video/webm","video/quicktime","audio/mpeg","audio/wav","audio/ogg","audio/mp4","application/pdf"])assert(bucket.allowed_mime_types.includes(mime));
    await assert.rejects(()=>db.query(`insert into vendor_media_uploads(id,store_id,object_path,url,mime_type,byte_size) values($1,$2,'invalid','invalid','video/mp4',104857601)`,[randomUUID(),store]),/check constraint/);
    assert.equal((await db.query(`select * from product_images where product_id=$1`,[product])).rows.length,1);
    console.log("PASS: fresh 0031/replay with and without Storage, legacy images/order preserved, bucket allowlist/100 MiB cap and database oversize constraint");
  } finally {await db.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
