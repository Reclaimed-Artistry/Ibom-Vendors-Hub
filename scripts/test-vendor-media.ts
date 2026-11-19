import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { systemDb, withActor, withSystem } from "../src/lib/db";
import { firstListingImage, matchesMediaSignature, MAX_PRODUCT_MEDIA_BYTES, mediaKind, PRODUCT_MEDIA_ACCEPT, validateProductMedia } from "../src/lib/product-media";
import { uploadProductMedia } from "../src/lib/product-media-upload";
import { cleanupExpiredProductMedia, completeProductMediaUpload, createProductMediaUpload, findProductMediaUpload, type MediaUpload } from "../src/lib/vendor-media-storage";
import { productStructuredData } from "../src/lib/structured-data";
import type { Product, Store } from "../src/lib/types";

async function main() {
  assert(["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5544/postgres").hostname), "Local fixtures only");
  const gif = await readFile(new URL("./fixtures/vendor-media/animated.gif", import.meta.url));
  const mp4 = await readFile(new URL("./fixtures/vendor-media/sample.mp4", import.meta.url));
  for (const [name, type] of Object.entries({ "a.jpg":"image/jpeg", "a.png":"image/png", "a.webp":"image/webp", "a.gif":"image/gif", "a.avif":"image/avif", "a.mp4":"video/mp4", "a.webm":"video/webm", "a.mov":"video/quicktime", "a.m4v":"video/x-m4v", "a.mp3":"audio/mpeg", "a.wav":"audio/x-wav", "a.ogg":"audio/ogg", "a.m4a":"audio/x-m4a" })) {
    assert(validateProductMedia({ name, type, size: MAX_PRODUCT_MEDIA_BYTES }));
    assert(PRODUCT_MEDIA_ACCEPT.includes(`.${name.split(".")[1]}`));
  }
  assert.equal(validateProductMedia({ name:"PHOTO.JPEG", type:"", size:1 }).mimeType,"image/jpeg");
  assert.equal(validateProductMedia({ name:"clip.mp4", type:"application/octet-stream", size:MAX_PRODUCT_MEDIA_BYTES }).mimeType,"video/mp4");
  for (const size of [0,-1,0.5,NaN,MAX_PRODUCT_MEDIA_BYTES+1]) assert.throws(()=>validateProductMedia({name:"clip.mp4",type:"video/mp4",size}));
  for (const name of ["script.html","renamed.exe","picture.svg","archive.zip","proof.pdf","video.mkv"]) assert.throws(()=>validateProductMedia({name,type:"",size:100}));
  assert.throws(()=>validateProductMedia({name:"video.mp4",type:"text/html",size:100}));
  assert(matchesMediaSignature(gif,"image/gif")); assert(matchesMediaSignature(mp4,"video/mp4"));
  assert(!matchesMediaSignature(Buffer.from("<html>not a GIF</html>"),"image/gif"));
  assert(!matchesMediaSignature(gif,"video/mp4"));
  assert.equal(mediaKind("https://storage.test/video.MP4?token=a"),"video");
  assert.equal(mediaKind({url:"/opaque-url",mime_type:"audio/mp4"}),"audio");
  const images=[{url:"/clip.mp4",mime_type:"video/mp4"},{url:"/sound.m4a",mime_type:"audio/mp4"},{url:"/animated.gif",mime_type:"image/gif"}];
  assert.equal(firstListingImage(images),"/animated.gif");
  console.log("PASS: format allowlist, MIME aliases/fallbacks, byte signatures, 100 MiB inclusive boundary and oversize/unsafe-type rejection");

  const fetchBefore=globalThis.fetch;
  const xhrBefore=globalThis.XMLHttpRequest;
  const envBefore={url:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY,vercel:process.env.VERCEL};
  const userId=randomUUID(),storeId=randomUUID(),otherUser=randomUUID(),otherStore=randomUUID();
  const slug=`media-unit-${randomUUID()}`;
  const ready: MediaUpload[]=[];
  try {
    await withSystem(async db=>{
      for(const [user,store,name] of [[userId,storeId,slug],[otherUser,otherStore,`other-${slug}`]]) {
        await db.execute(`insert into users(id,email,full_name,role) values($1,$2,'Media test','vendor')`,[user,`${name}@example.test`]);
        await db.execute(`insert into stores(id,owner_id,name,slug,status,visibility) values($1,$2,$3,$3,'active','public')`,[store,user,name]);
      }
    });
    process.env.NEXT_PUBLIC_SUPABASE_URL="https://storage.example.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY="unit-test-service-role-key-only";
    let declaredSize=gif.length, actualSize=gif.length, type="image/gif", bytes:Uint8Array=gif;
    let cleanupFailure=false;
    const calls:Array<{url:string;method:string;body?:string}>=[];
    globalThis.fetch=async(input,init)=>{
      const url=String(input), method=init?.method ?? "GET"; calls.push({url,method,body:typeof init?.body==="string"?init.body:undefined});
      assert(url.startsWith("https://storage.example.test/"),"No external network requests in storage tests");
      if(method==="POST"&&url.includes("/upload/sign/")) {
        assert.equal(new Headers(init?.headers).get("authorization"),"Bearer unit-test-service-role-key-only");
        assert.equal(new Headers(init?.headers).get("x-upsert"),"false");
        return Response.json({url:url.replace("https://storage.example.test/storage/v1","")+"?token=single-object-test-token"});
      }
      if(method==="HEAD")return new Response(null,{headers:{"content-length":String(actualSize),"content-type":type}});
      if(method==="DELETE")return Response.json({}, {status:cleanupFailure?503:200});
      assert.equal(new Headers(init?.headers).get("range"),"bytes=0-4095");
      return new Response(Buffer.from(bytes),{status:206});
    };
    async function prepare(name:string,size=declaredSize,mime=type,store={id:storeId,slug}) {
      const result=await createProductMediaUpload(store,{name,type:mime,size});
      assert(!JSON.stringify(result).includes("unit-test-service-role-key-only"),"Never expose service credentials");
      assert(result.uploadUrl.includes(`stores/${store.slug}/products/${result.id}.`));
      const session=await findProductMediaUpload(result.id,store.id);assert(session);return session;
    }
    ready.push(await prepare("animated.gif"));
    const completed=await completeProductMediaUpload(ready[0]);assert.equal(completed.mime_type,"image/gif");assert.equal(completed.byte_size,gif.length);
    assert.equal((await findProductMediaUpload(completed.id,storeId))?.status,"ready");
    assert.equal(await findProductMediaUpload(completed.id,otherStore),null);
    type="video/mp4";declaredSize=MAX_PRODUCT_MEDIA_BYTES;actualSize=declaredSize;bytes=mp4;
    ready.push(await prepare("limit.mp4"));
    assert.equal((await completeProductMediaUpload(ready[1])).byte_size,MAX_PRODUCT_MEDIA_BYTES);
    const oversized=await prepare("wrong-size.mp4");actualSize=MAX_PRODUCT_MEDIA_BYTES+1;
    await assert.rejects(()=>completeProductMediaUpload(oversized),/file content, type or size/);
    assert.equal((await findProductMediaUpload(oversized.id,storeId))?.status,"failed");
    actualSize=declaredSize;const spoofed=await prepare("spoofed.mp4");bytes=Buffer.from("<html>not video</html>");
    await assert.rejects(()=>completeProductMediaUpload(spoofed),/file content, type or size/);
    bytes=mp4;const expired=await prepare("expired.mp4");expired.expires_at=new Date(0).toISOString();
    await assert.rejects(()=>completeProductMediaUpload(expired),/expired/);
    assert(calls.some(call=>call.method==="DELETE"&&call.body?.includes(spoofed.object_path)));
    console.log("PASS: store-scoped single-object signed URLs, no key disclosure, actual size/signature verification, 100 MiB acceptance, invalid-file removal, expiry and cross-store lookup rejection");

    const product=await systemDb.one<Product>(`insert into products(store_id,name,slug,price) values($1,'Media test','media-test',2500) returning *`,[storeId]);
    await withActor({id:userId,role:"vendor",email:null},async db=>{
      await db.execute(`insert into product_images(product_id,url,mime_type,byte_size,upload_id) values($1,$2,$3,$4,$5)`,[product.id,completed.url,completed.mime_type,completed.byte_size,completed.id]);
      assert.equal((await db.query(`select id from vendor_media_uploads where store_id=$1`,[otherStore])).length,0);
    });
    let changed = 0;
    try { changed = await withActor({id:userId,role:"vendor",email:null},db=>db.execute(`update vendor_media_uploads set status='ready' where id=$1`,[spoofed.id])); }
    catch (error) { assert.match(String(error), /permission denied|row-level security/); }
    assert.equal(changed, 0);
    assert.equal((await findProductMediaUpload(spoofed.id,storeId))?.status,"failed","a vendor cannot mark unverified media as ready");
    await assert.rejects(()=>withActor({id:otherUser,role:"vendor",email:null},db=>db.execute(`insert into product_images(product_id,url,mime_type,byte_size,upload_id) values($1,$2,$3,$4,$5)`,[product.id,completed.url,completed.mime_type,completed.byte_size,completed.id])),/row-level security/);
    const otherProduct=await systemDb.one<{id:string}>(`insert into products(store_id,name,slug,price) values($1,'Other media test','other-media',2500) returning id`,[otherStore]);
    await assert.rejects(()=>withActor({id:otherUser,role:"vendor",email:null},db=>db.execute(`insert into product_images(product_id,url,mime_type,byte_size,upload_id) values($1,$2,$3,$4,$5)`,[otherProduct.id,completed.url,completed.mime_type,completed.byte_size,completed.id])),/verified upload belonging to this store/);
    await assert.rejects(()=>systemDb.execute(`insert into product_images(product_id,url,mime_type,byte_size,upload_id) values($1,$2,$3,$4,$5)`,[product.id,completed.url,completed.mime_type,1,completed.id]),/verified upload belonging to this store/);
    for(const url of [completed.url,`${completed.url}?raw-link=1`]) {
      await assert.rejects(()=>withActor({id:userId,role:"vendor",email:null},db=>db.execute(`insert into product_images(product_id,url) values($1,$2)`,[product.id,url])),/verified upload ID/);
    }
    const store=await systemDb.one<Store>(`select * from stores where id=$1`,[storeId]);
    const schema=productStructuredData({...product,images},store,null);
    assert.equal(schema.image?.length,1);
    const schemaImage = schema.image?.[0]; assert(schemaImage);
    assert.equal(new URL(schemaImage).pathname,"/animated.gif");
    console.log("PASS: real app_runtime RLS, write-protected verification records, metadata/cross-tenant attachment guards and image-only SEO fields");
    await systemDb.execute(`update vendor_media_uploads set expires_at=now()-interval '1 day' where id=any($1::uuid[])`,[[completed.id,expired.id,ready[1].id]]);
    await assert.rejects(()=>withActor({id:userId,role:"vendor",email:null},db=>db.execute(`insert into product_images(product_id,url,mime_type,byte_size,upload_id) values($1,$2,$3,$4,$5)`,[product.id,ready[1].url,ready[1].mime_type,ready[1].byte_size,ready[1].id])),/expired/);
    await withActor({id:userId,role:"vendor",email:null},db=>db.execute(`update product_images set alt='Still published after session expiry' where product_id=$1`,[product.id]));
    cleanupFailure=true;
    const retry=await cleanupExpiredProductMedia();assert.equal(retry.removed,0);assert(retry.retry&&retry.retry>=1);
    assert.equal((await findProductMediaUpload(ready[1].id,storeId))?.status,"failed","cleanup claims the receipt before attempting object deletion");
    await assert.rejects(()=>withActor({id:userId,role:"vendor",email:null},db=>db.execute(`insert into product_images(product_id,url,mime_type,byte_size,upload_id) values($1,$2,$3,$4,$5)`,[product.id,ready[1].url,ready[1].mime_type,ready[1].byte_size,ready[1].id])),/verified upload belonging to this store/);
    cleanupFailure=false;
    assert((await cleanupExpiredProductMedia()).removed>=1);
    assert.equal(await findProductMediaUpload(expired.id,storeId),null,"abandoned, expired uploads are cleaned");
    assert(await findProductMediaUpload(completed.id,storeId),"published media are retained even after their upload session expires");
    console.log("PASS: claim-before-delete cleanup, failed-deletion retry, expired attachment rejection and preservation of published media");

    let uploadedFile:File|undefined;const progress:string[]=[];
    class FakeXHR {
      status=200;responseText="{}";timeout=0;upload:{onprogress?:(event:{lengthComputable:boolean;loaded:number;total:number})=>void}={};
      onload?:()=>void;onabort?:()=>void;
      open(method:string,url:string){assert.equal(method,"PUT");assert.equal(url,"https://storage.example.test/direct-file?token=limited");}
      setRequestHeader(name:string,value:string){assert.equal(name,"Content-Type");assert.equal(value,"image/gif");}
      send(file:File){uploadedFile=file;this.upload.onprogress?.({lengthComputable:true,loaded:file.size,total:file.size});queueMicrotask(()=>this.onload?.());}
      abort(){this.onabort?.();}
    }
    globalThis.XMLHttpRequest=FakeXHR as unknown as typeof XMLHttpRequest;
    globalThis.fetch=async(input,init)=>{
      assert.equal(init?.headers&&new Headers(init.headers).get("content-type"),"application/json");
      assert.equal(typeof init?.body,"string","Only small JSON metadata crosses the app API");
      if(input==="/api/vendor-media")return Response.json({id:completed.id,uploadUrl:"https://storage.example.test/direct-file?token=limited",mimeType:"image/gif"});
      assert.equal(input,`/api/vendor-media/${completed.id}`);return Response.json({media:completed});
    };
    const animated=new File([Buffer.concat([gif,Buffer.alloc(1_300_000)])],"animated.gif",{type:"image/gif"});
    await uploadProductMedia(animated,update=>progress.push(update.stage));
    assert.equal(uploadedFile,animated,"GIF is uploaded byte-for-byte, never flattened or compressed by canvas");
    assert(progress.includes("uploading")&&progress.includes("verifying"));
    console.log("PASS: animated GIF bytes preserved, direct binary transfer and progress/verification stages (no multipart/server-action file payload)");
  } finally {
    globalThis.fetch=fetchBefore;globalThis.XMLHttpRequest=xhrBefore;
    if(envBefore.url===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=envBefore.url;
    if(envBefore.key===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=envBefore.key;
    if(envBefore.vercel===undefined)delete process.env.VERCEL;else process.env.VERCEL=envBefore.vercel;
    await withSystem(async db=>{await db.execute(`delete from stores where id=any($1::uuid[])`,[[storeId,otherStore]]);await db.execute(`delete from users where id=any($1::uuid[])`,[[userId,otherUser]]);});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
