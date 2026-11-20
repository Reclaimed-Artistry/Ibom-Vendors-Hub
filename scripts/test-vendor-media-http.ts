/** Real HTTP uploads/form actions. Never run mutating fixtures against production. */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { request } from "node:http";
import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { JSDOM } from "jsdom";
import { createSessionToken } from "../src/lib/auth";
import { systemDb, withSystem } from "../src/lib/db";
import { MAX_PRODUCT_MEDIA_BYTES, type UploadedProductMedia } from "../src/lib/product-media";

const BASE=process.env.MEDIA_TEST_BASE_URL ?? "http://127.0.0.1:3000";
const HOST="www.ibomvendorshub.com";
async function http(url:string,method="GET",body?:Buffer,cookie="",extra:Record<string,string>={}) {
  return new Promise<{status:number;body:Buffer;headers:Record<string,string|string[]|undefined>}>((resolve,reject)=>{
    const req=request(new URL(url,BASE),{method,headers:{host:HOST,origin:`https://${HOST}`,cookie,...(body?{"content-length":String(body.length)}:{}),...extra}},res=>{
      const chunks:Buffer[]=[];res.on("data",chunk=>chunks.push(Buffer.from(chunk)));res.on("end",()=>resolve({status:res.statusCode??0,body:Buffer.concat(chunks),headers:res.headers}));res.on("error",reject);
    });
    req.setTimeout(60000,()=>req.destroy(new Error(`Media HTTP timeout: ${url}`)));req.on("error",reject);req.end(body);
  });
}
async function json(url:string,body:unknown,cookie="",extra:Record<string,string>={}) {
  const result=await http(url,"POST",Buffer.from(JSON.stringify(body)),cookie,{"content-type":"application/json",...extra});
  return {...result,data:JSON.parse(result.body.toString())};
}
function form(html:string) {
  const dom=new JSDOM(html);const element=dom.window.document.querySelector('[name="marketplaceCategoryId"]')?.closest("form");assert(element,"Select the listing editor, never the separate delete-product form");
  const data=new FormData();for(const [key,value] of new dom.window.FormData(element).entries())if(typeof value==="string")data.append(key,value);
  dom.window.close();return data;
}
async function submit(url:string,data:FormData,cookie:string) {
  const encoded=new Request("http://local.test",{method:"POST",body:data});
  return http(url,"POST",Buffer.from(await encoded.arrayBuffer()),cookie,{"content-type":encoded.headers.get("content-type")!});
}
function wav() {
  const samples=22050;const bytes=Buffer.alloc(44+samples*2);bytes.write("RIFF");bytes.writeUInt32LE(bytes.length-8,4);bytes.write("WAVEfmt ",8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(samples,24);bytes.writeUInt32LE(samples*2,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write("data",36);bytes.writeUInt32LE(samples*2,40);return bytes;
}
async function main() {
  assert(["localhost","127.0.0.1"].includes(new URL(BASE).hostname),"Local HTTP server only");
  assert(["localhost","127.0.0.1"].includes(new URL(process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5544/postgres").hostname),"Local database only");
  process.env.AUTH_SECRET=process.env.MEDIA_TEST_AUTH_SECRET ?? "local-category-preview-auth-secret-only";
  const id=randomUUID(),storeId=randomUUID(),otherId=randomUUID(),otherStore=randomUUID(),customer=randomUUID();
  const slug=`media-http-${randomUUID()}`;
  const uploads:Array<{id:string;name:string}>=[];
  let keep=false;
  try {
    const category=await systemDb.one<{id:string}>(`select id from store_categories where slug='fashion-clothing'`);
    await withSystem(async db=>{
      for(const [user,store,name] of [[id,storeId,slug],[otherId,otherStore,`other-${slug}`]]){
        await db.execute(`insert into users(id,email,full_name,role,email_verified_at) values($1,$2,'Local media tester','vendor',now())`,[user,`${name}@example.test`]);
        await db.execute(`insert into stores(id,owner_id,category_id,name,slug,status,visibility,city) values($1,$2,$3,$4,$4,'active','public','Uyo')`,[store,user,category.id,name]);
      }
      await db.execute(`insert into users(id,email,full_name,role,email_verified_at) values($1,$2,'Media customer','customer',now())`,[customer,`${customer}@example.test`]);
    });
    const cookie=`ivh_session_shared=${await createSessionToken({sub:id,email:`${slug}@example.test`,role:"vendor",name:"Local media tester"})}`;
    const foreignCookie=`ivh_session_shared=${await createSessionToken({sub:otherId,email:`other-${slug}@example.test`,role:"vendor",name:"Other media tester"})}`;
    const customerCookie=`ivh_session_shared=${await createSessionToken({sub:customer,email:`${customer}@example.test`,role:"customer",name:"Media customer"})}`;
    const details={name:"clip.mp4",type:"video/mp4",size:100};
    assert.equal((await json("/api/vendor-media",details)).status,401);
    assert.equal((await json("/api/vendor-media",details,customerCookie)).status,403);
    assert.equal((await json("/api/vendor-media",details,cookie,{origin:"https://attacker.example"})).status,403);
    for(const bad of [{...details,size:0},{...details,size:MAX_PRODUCT_MEDIA_BYTES+1},{...details,name:"script.html",type:"text/html"},{...details,type:"text/html"}])assert.equal((await json("/api/vendor-media",bad,cookie)).status,400);
    await systemDb.execute(`update stores set manual_suspension=true where id=$1`,[storeId]);
    assert.equal((await json("/api/vendor-media",details,cookie)).status,403);
    await systemDb.execute(`update stores set manual_suspension=false where id=$1`,[storeId]);
    console.log("PASS: anonymous/customer/cross-origin/suspended requests rejected; empty, unsupported and over-100 MiB uploads rejected before transfer");

    async function upload(name:string,type:string,bytes:Buffer,asCookie=cookie) {
      const prepared=await json("/api/vendor-media",{name,type,size:bytes.length},asCookie);assert.equal(prepared.status,200,prepared.body.toString());
      assert.equal(typeof prepared.data.uploadUrl,"string");assert(!JSON.stringify(prepared.data).includes("service_role"));
      uploads.push({id:prepared.data.id,name});
      const transferred = await http(`/api/vendor-media/${prepared.data.id}`,"PUT",bytes,asCookie,{"content-type":type});
      assert.equal(transferred.status,200,transferred.body.toString());
      const completed=await json(`/api/vendor-media/${prepared.data.id}`,{},asCookie);assert.equal(completed.status,200,completed.body.toString());
      return completed.data.media as UploadedProductMedia;
    }
    const gifBytes=await readFile(new URL("./fixtures/vendor-media/animated.gif",import.meta.url));
    const videoBytes=await readFile(new URL("./fixtures/vendor-media/sample.mp4",import.meta.url));
    const gif=await upload("animated.gif","image/gif",gifBytes);
    assert.deepEqual((await http(gif.url)).body,gifBytes,"animation bytes must not be flattened or recompressed");
    const video=await upload("sample.mp4","video/mp4",videoBytes);
    const audio=await upload("sample.wav","audio/wav",wav());
    const head=await http(video.url,"HEAD");assert.equal(head.status,200);assert.equal(head.headers["content-type"],"video/mp4");assert.equal(head.headers["accept-ranges"],"bytes");assert.equal(head.body.length,0);
    const range=await http(video.url,"GET",undefined,"",{range:"bytes=0-31"});assert.equal(range.status,206);assert.deepEqual(range.body,videoBytes.subarray(0,32));assert.equal(range.headers["content-range"],`bytes 0-31/${videoBytes.length}`);
    assert.equal((await http(video.url,"GET",undefined,"",{range:"bytes=999999999-"})).status,416);
    assert.equal((await json(`/api/vendor-media/${video.id}`,{},foreignCookie)).status,404);
    const invalid=await json("/api/vendor-media",{name:"fake.gif",type:"image/gif",size:12},cookie);uploads.push({id:invalid.data.id,name:"fake.gif"});
    assert.equal((await http(invalid.data.uploadUrl,"PUT",Buffer.from("not a gif!!!"),cookie,{"content-type":"image/gif"})).status,200);
    assert.equal((await json(`/api/vendor-media/${invalid.data.id}`,{},cookie)).status,400);
    assert.equal((await systemDb.one(`select status from vendor_media_uploads where id=$1`,[invalid.data.id])).status,"failed");
    console.log("PASS: real GIF/MP4/WAV transfer, unchanged GIF bytes, verification, byte-range seeking/HEAD, invalid-content rejection and cross-store completion protection");

    // 100 MiB of real HTTP body, not just a mocked File.size or storage header.
    const large=Buffer.alloc(MAX_PRODUCT_MEDIA_BYTES);videoBytes.copy(large);large.writeUInt32BE(large.length-videoBytes.length,videoBytes.length);large.write("free",videoBytes.length+4);
    const limit=await upload("exactly-100mb.mp4","video/mp4",large);
    const saved=await readFile(path.join(process.cwd(),".data","vendor-media",`${limit.id}.mp4`));
    assert.equal(saved.length,MAX_PRODUCT_MEDIA_BYTES);assert.equal(createHash("sha256").update(saved).digest("hex"),createHash("sha256").update(large).digest("hex"));
    assert.equal((await systemDb.one(`select byte_size from vendor_media_uploads where id=$1`,[limit.id])).byte_size,MAX_PRODUCT_MEDIA_BYTES);
    console.log("PASS: an actual 104,857,600-byte MP4 uploads, verifies and is stored byte-for-byte; the next byte is rejected by metadata validation");

    const page=await http("/vendor/products/new","GET",undefined,cookie);assert.equal(page.status,200);
    const data=form(page.body.toString());
    for(const [key,value] of Object.entries({name:"Mixed media listing",description:"Local media fixture",price:"2500",marketplaceCategoryId:category.id,kind:"product"}))data.set(key,value);
    for(const media of [video,gif,audio])data.append("uploadedMediaIds",media.id);
    const result=await submit("/vendor/products/new",data,cookie);assert.equal(result.status,303,result.body.toString().slice(-1000));
    const product=await systemDb.one<{id:string;slug:string}>(`select id,slug from products where store_id=$1 and name='Mixed media listing'`,[storeId]);
    const media=await systemDb.query(`select url,mime_type,byte_size,upload_id,sort_order from product_images where product_id=$1 order by sort_order`,[product.id]);
    assert.deepEqual(media.map(item=>item.mime_type),["video/mp4","image/gif","audio/wav"]);assert.equal(media[0].upload_id,video.id);
    const publicPage=await http(`/products/${product.slug}`,"GET",undefined,"",{host:`${slug}.ibomvendorshub.com`});assert.equal(publicPage.status,200);
    const dom=new JSDOM(publicPage.body.toString());assert(dom.window.document.querySelector("video[controls]"));
    assert(!dom.window.document.querySelector('meta[property="og:image"]')?.getAttribute("content")?.endsWith(".mp4"));
    assert(dom.window.document.querySelector('[aria-label="View audio 3 of 3"]'));dom.window.close();
    const editPage=await http(`/vendor/products/${product.id}`,"GET",undefined,cookie);
    const rawLink=form(editPage.body.toString());
    rawLink.append("imageUrls",`https://storage.example.test/storage/v1/object/public/storefronts/stores/${slug}/products/${gif.id}.gif?raw-link=1`);
    const rawDenied=await submit(`/vendor/products/${product.id}`,rawLink,cookie);
    assert.equal(rawDenied.status,200);assert(rawDenied.body.toString().includes("verified upload ID"),"managed media cannot bypass receipts through the legacy image URL field");
    const hijack=form(editPage.body.toString());hijack.append("uploadedMediaIds",limit.id);
    const foreign=await upload("foreign.mp4","video/mp4",videoBytes,foreignCookie);
    hijack.append("uploadedMediaIds",foreign.id);
    const denied=await submit(`/vendor/products/${product.id}`,hijack,cookie);assert.equal(denied.status,200);assert(denied.body.toString().includes("belongs to another store"));
    assert.equal((await systemDb.one(`select count(*)::int n from product_images where product_id=$1`,[product.id])).n,3);
    const remove=form(editPage.body.toString());const old=await systemDb.one<{id:string}>(`select id from product_images where product_id=$1 and upload_id=$2`,[product.id,gif.id]);remove.append("removeImage",old.id);remove.append("uploadedMediaIds",limit.id);
    assert.equal((await submit(`/vendor/products/${product.id}`,remove,cookie)).status,303);
    const sorted=await systemDb.query(`select sort_order from product_images where product_id=$1 order by sort_order`,[product.id]);assert.deepEqual(sorted.map(item=>item.sort_order),[0,2,3],"new media append after the largest remaining order, not the row count");
    const overflow=form((await http(`/vendor/products/${product.id}`,"GET",undefined,cookie)).body.toString());
    for(let index=0;index<8;index++)overflow.append("imageUrls",`https://images.example.test/${index}.jpg`);
    const rejected=await submit(`/vendor/products/${product.id}`,overflow,cookie);assert.equal(rejected.status,200);assert(rejected.body.toString().includes("up to 10 media files"));
    assert.equal((await systemDb.one(`select count(*)::int n from product_images where product_id=$1`,[product.id])).n,3,"failed save rolls back media changes");
    console.log("PASS: actual listing create/edit actions persist media IDs/types/size/order, render video/gallery controls, preserve SEO images, reject cross-store attachment and enforce the combined 10-file limit atomically");
    if(process.env.MEDIA_TEST_KEEP_FIXTURES==="1") {
      await writeFile(".data/vendor-media-browser-fixture.json",JSON.stringify({userId:id,storeId,otherId,otherStore,customer,slug,cookie,product,uploads}));keep=true;
      console.log("Local browser fixture retained in ignored .data/vendor-media-browser-fixture.json");
    }
  } finally {
    if(!keep){
      for(const upload of uploads)for(const extension of ["gif","mp4","wav"])await unlink(path.join(process.cwd(),".data","vendor-media",`${upload.id}.${extension}`)).catch(()=>{});
      await withSystem(async db=>{await db.execute(`delete from stores where id=any($1::uuid[])`,[[storeId,otherStore]]);await db.execute(`delete from users where id=any($1::uuid[])`,[[id,otherId,customer]]);});
    }
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
