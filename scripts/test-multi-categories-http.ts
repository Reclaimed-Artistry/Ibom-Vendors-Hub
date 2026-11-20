/** Actual production-server form actions against isolated local fixtures. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { request } from "node:http";
import { JSDOM } from "jsdom";
import { systemDb, withSystem } from "../src/lib/db";
import { createSessionToken } from "../src/lib/auth";
import { getCategoryBookingProfile } from "../src/lib/artisan-bookings";
import type { StoreCategory } from "../src/lib/types";

const BASE = process.env.CATEGORY_TEST_BASE_URL ?? "http://127.0.0.1:3000";
const HOST = "www.ibomvendorshub.com";
interface Response { status: number; text: string; location?: string }
async function http(path: string, cookie: string, data?: FormData | Array<[string, string]>, origin = `https://${HOST}`): Promise<Response> {
  let body: Buffer | undefined; let contentType: string | undefined;
  if (Array.isArray(data)) {
    body = Buffer.from(JSON.stringify(data)); contentType = "application/json";
  } else if (data) {
    const encoded = new Request("http://local.test", {method:"POST",body:data});
    body = Buffer.from(await encoded.arrayBuffer()); contentType = encoded.headers.get("content-type")!;
  }
  return new Promise((resolve,reject) => {
    const req = request(new URL(path,BASE), {method:data?"POST":"GET",headers:{host:HOST,origin,cookie,...(body?{"content-type":contentType!,"content-length":body.length}:{})}}, res => {
      let text=""; res.setEncoding("utf8"); res.on("data",chunk=>{text+=chunk;});
      res.on("end",()=>resolve({status:res.statusCode??0,text,location:res.headers.location})); res.on("error",reject);
    });
    req.setTimeout(30000,()=>req.destroy(new Error(`HTTP test timed out: ${path}`))); req.on("error",reject); req.end(body);
  });
}
function form(html: string, field: string) {
  const dom = new JSDOM(html);
  const element = dom.window.document.querySelector(`[name="${field}"]`)?.closest("form");
  assert(element, `Form with ${field} is rendered`);
  const data = new FormData();
  for (const [key,value] of new dom.window.FormData(element).entries()) if (typeof value === "string") data.append(key,value);
  dom.window.close(); return data;
}

async function main() {
  assert(["localhost","127.0.0.1"].includes(new URL(BASE).hostname),"Never submit fixture actions to production");
  assert(["localhost","127.0.0.1"].includes(new URL(process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5544/postgres").hostname),"Local database only");
  process.env.AUTH_SECRET = process.env.CATEGORY_TEST_AUTH_SECRET ?? "local-category-preview-auth-secret-only";
  const userId=randomUUID(),storeId=randomUUID(),otherStoreId=randomUUID(),otherUserId=randomUUID(),registrationUserId=randomUUID();
  const slug=`category-http-${randomUUID()}`;
  const email=`${slug}@example.test`;
  const taxonomy=await systemDb.query<StoreCategory>(`select * from store_categories where is_active`);
  const category=(slug:string)=>{const found=taxonomy.find(row=>row.slug===slug);assert(found,slug);return found;};
  const fashion=category("fashion-clothing"),packaging=category("branding-packaging"),property=category("house-agents-realtors"),beauty=category("beauty-personal-care"),household=category("household-products");
  const enquiry=taxonomy.find(row=>row.features.inquiryOnly);assert(enquiry);
  let sectionId="",foreignSectionId="",foreignProductId="";
  try {
    await withSystem(async db=>{
      for(const [id,store,storeSlug] of [[userId,storeId,slug],[otherUserId,otherStoreId,`other-${slug}`]]) {
        await db.execute(`insert into users(id,email,full_name,role,email_verified_at) values($1,$2,'HTTP Category Tester','vendor',now())`,[id,`${storeSlug}@example.test`]);
        await db.execute(`insert into stores(id,owner_id,category_id,name,slug,email,phone,description,address,city,state,status,visibility,manual_suspension,accepts_orders,accepts_pickup)
          values($1,$2,$3,$4,$5,$6,$7,'Local category HTTP fixture','10 Fixture Road, Uyo','Uyo','Akwa Ibom','active','public',false,true,true)`,[store,id,fashion.id,`HTTP Fixture ${storeSlug}`,storeSlug,`${storeSlug}@example.test`,"08031234567"]);
      }
      await db.execute(`insert into users(id,email,full_name,role,email_verified_at) values($1,$2,'Registration Category Tester','customer',now())`,[registrationUserId,`register-${slug}@example.test`]);
      sectionId=(await db.one<{id:string}>(`insert into product_categories(store_id,name,slug) values($1,'My section','my-section') returning id`,[storeId])).id;
      foreignSectionId=(await db.one<{id:string}>(`insert into product_categories(store_id,name,slug) values($1,'Foreign section','foreign-section') returning id`,[otherStoreId])).id;
      foreignProductId=(await db.one<{id:string}>(`insert into products(store_id,name,slug,price) values($1,'Foreign product','foreign-product',1000) returning id`,[otherStoreId])).id;
    });
    const token=await createSessionToken({sub:userId,email,role:"vendor",name:"HTTP Category Tester"});
    const cookie=`ivh_session_shared=${token}`;
    const saveListing=async(name:string,categoryId:string,overrides:Record<string,string>={})=>{
      const page=await http("/vendor/products/new",cookie);assert.equal(page.status,200);
      const data=form(page.text,"marketplaceCategoryId");
      for(const [key,value] of Object.entries({name,description:"Local category integration fixture",price:"2500",categoryId:sectionId,marketplaceCategoryId:categoryId,kind:"product",attributesJson:"{}",...overrides}))data.set(key,value);
      return http("/vendor/products/new",cookie,data);
    };
    const clothesResult=await saveListing("HTTP clothes",fashion.id);assert.equal(clothesResult.status,303,clothesResult.text.slice(-500));
    const boxesResult=await saveListing("HTTP branded boxes",packaging.id);assert.equal(boxesResult.status,303,boxesResult.text.slice(-500));
    const listings=await systemDb.query<{id:string;slug:string;name:string;marketplace_category_id:string;category_id:string}>(`select id,slug,name,marketplace_category_id,category_id from products where store_id=$1`,[storeId]);
    const clothes=listings.find(row=>row.name==="HTTP clothes"),boxes=listings.find(row=>row.name==="HTTP branded boxes");assert(clothes&&boxes);
    assert.equal(clothes.marketplace_category_id,fashion.id);assert.equal(boxes.marketplace_category_id,packaging.id);assert.equal(boxes.category_id,sectionId);
    assert.equal((await systemDb.one(`select count(*)::int n from store_category_assignments where store_id=$1`,[storeId])).n,2,"product action expands store category membership atomically");
    const spoofSection=await saveListing("Must not save",beauty.id,{categoryId:foreignSectionId});
    assert.equal(spoofSection.status,200);assert(spoofSection.text.includes("own store"));
    assert.equal((await systemDb.one(`select count(*)::int n from store_category_assignments where store_id=$1`,[storeId])).n,2,"failed listing does not leave a new category behind");
    let page=await http(`/vendor/products/${boxes.id}`,cookie);assert.equal(page.status,200);
    let data=form(page.text,"marketplaceCategoryId");data.set("productId",foreignProductId);data.set("name","Hijack attempt");
    const crossStore=await http(`/vendor/products/${boxes.id}`,cookie,data);assert.equal(crossStore.status,200);assert(crossStore.text.includes("not owned by you"));
    assert.equal((await systemDb.one(`select name from products where id=$1`,[foreignProductId])).name,"Foreign product");
    console.log("PASS: real product form actions persist independent category/section, add new business lines, roll back failures and reject cross-store edits");

    const acknowledged = await saveListing("HTTP acknowledged product", fashion.id, { clientSaveNavigation: "1" });
    assert.equal(acknowledged.status, 200, "hydrated editors receive a confirmed-save result, not a streamed 303 redirect");
    const confirmed = await systemDb.one<{ id: string }>(`select id from products where store_id=$1 and name='HTTP acknowledged product'`, [storeId]);
    assert(acknowledged.text.includes(`/vendor/products/${confirmed.id}?saved=1`), "the acknowledgement points to the actual committed listing");
    assert(acknowledged.text.includes("Product saved"));
    assert(acknowledged.text.includes("Open saved product"), "a usable fallback link is rendered even if browser navigation is blocked");
    assert.equal((await systemDb.one(`select count(*)::int n from products where store_id=$1 and name='HTTP acknowledged product'`, [storeId])).n, 1);
    console.log("PASS: hydrated product-save acknowledgement returns the committed listing URL and fallback confirmation; legacy HTML submissions keep 303 redirects");

    const apiFields: Array<[string, string]> = [["name", "HTTP API product"], ["description", "Isolated authenticated JSON save fixture"], ["price", "4500"], ["marketplaceCategoryId", fashion.id], ["categoryId", sectionId], ["kind", "product"], ["trackStock", "true"], ["stockQuantity", "7"]];
    assert.equal((await http("/api/vendor-products", "", apiFields)).status, 401);
    const shopperCookie = `ivh_session_shared=${await createSessionToken({ sub: registrationUserId, email: `register-${slug}@example.test`, role: "customer", name: "Product API customer" })}`;
    assert.equal((await http("/api/vendor-products", shopperCookie, apiFields)).status, 403);
    assert.equal((await http("/api/vendor-products", cookie, apiFields, "https://attacker.example")).status, 403);
    assert.equal((await http("/api/vendor-products", cookie, apiFields, "")).status, 403);
    await systemDb.execute(`update stores set manual_suspension=true where id=$1`, [storeId]);
    assert.equal((await http("/api/vendor-products", cookie, apiFields)).status, 403);
    await systemDb.execute(`update stores set manual_suspension=false where id=$1`, [storeId]);
    assert.equal((await http("/api/vendor-products", cookie, [["name", "oversized"], ["description", "x".repeat(256 * 1024)]])).status, 413);
    assert.equal((await http("/api/vendor-products", cookie, [["name", "x"]])).status, 422);
    assert.equal((await http("/api/vendor-products", cookie, [...apiFields, ["productId", foreignProductId]])).status, 422);
    assert.equal((await systemDb.one(`select name from products where id=$1`, [foreignProductId])).name, "Foreign product");
    const apiSaved = await http("/api/vendor-products", cookie, apiFields);
    assert.equal(apiSaved.status, 200, apiSaved.text);
    const apiResult = JSON.parse(apiSaved.text);
    const apiProduct = await systemDb.one<{ id: string; price: string; stock_quantity: number; category_id: string }>(`select id,price,stock_quantity,category_id from products where store_id=$1 and name='HTTP API product'`, [storeId]);
    assert.equal(apiResult.redirectUrl, `/vendor/products/${apiProduct.id}?saved=1`);
    assert.equal(apiResult.message, "Product saved."); assert.equal(Number(apiProduct.price), 4500); assert.equal(apiProduct.stock_quantity, 7); assert.equal(apiProduct.category_id, sectionId);
    const editedApiFields = apiFields.map(([key, value]): [string, string] => [key, key === "price" ? "4700" : value]);
    const apiEdited = await http("/api/vendor-products", cookie, [...editedApiFields, ["productId", apiProduct.id]]);
    assert.equal(apiEdited.status, 200); assert.equal(JSON.parse(apiEdited.text).redirectUrl, apiResult.redirectUrl);
    assert.equal(Number((await systemDb.one(`select price from products where id=$1`, [apiProduct.id])).price), 4700);
    assert.equal((await systemDb.one(`select count(*)::int n from products where store_id=$1 and name='HTTP API product'`, [storeId])).n, 1);
    console.log("PASS: small JSON create/edit confirmation persists real listings; anonymous/customer/missing-origin/cross-origin/suspended/oversized/invalid/cross-store requests are rejected");

    const setCategories=async(primary:string,slugs:string[])=>{
      const page=await http("/vendor/store",cookie);assert.equal(page.status,200);
      const data=form(page.text,"categorySlug");data.set("categorySlug",primary);data.delete("categorySlugs");for(const slug of slugs)data.append("categorySlugs",slug);
      return http("/vendor/store",cookie,data);
    };
    const used=await setCategories(packaging.slug,[packaging.slug]);assert.equal(used.status,200);assert(used.text.includes("still have listings"));
    const invalid=await setCategories(fashion.slug,[fashion.slug,packaging.slug,"not-a-category"]);assert.equal(invalid.status,200);assert(invalid.text.includes("invalid or no longer available"));
    const slugs=[fashion.slug,packaging.slug,property.slug,beauty.slug,enquiry.slug];
    const settings=await setCategories(property.slug,slugs);assert.equal(settings.status,200);assert(settings.text.includes("Store settings saved"));
    assert.equal((await systemDb.one(`select category_id from stores where id=$1`,[storeId])).category_id,property.id);
    assert.equal((await systemDb.one(`select marketplace_category_id from products where id=$1`,[clothes.id])).marketplace_category_id,fashion.id);
    page=await http(`/vendor/products/${boxes.id}`,cookie);
    data=form(page.text,"marketplaceCategoryId");
    data.delete("marketplaceCategoryId"); // Legacy edit must not adopt the new primary.
    data.set("description","Revised packaging description");
    data.set("variantsJson",JSON.stringify([{name:"Large box",price:"3500",stockQuantity:"5"}]));
    const edited=await http(`/vendor/products/${boxes.id}`,cookie,data);assert.equal(edited.status,303);
    const preserved=await systemDb.one(`select marketplace_category_id,category_id,description from products where id=$1`,[boxes.id]);
    assert.equal(preserved.marketplace_category_id,packaging.id);assert.equal(preserved.category_id,sectionId);assert.equal(preserved.description,"Revised packaging description");
    assert.equal((await systemDb.one(`select count(*)::int n from product_variants where product_id=$1`,[boxes.id])).n,1);
    assert.equal((await systemDb.one(`select count(*)::int n from product_images where product_id=$1`,[boxes.id])).n,1);
    const invalidProperty=await saveListing("Invalid property",property.id);assert.equal(invalidProperty.status,200);assert(invalidProperty.text.includes("Choose For rent or For sale"));
    const moreClothes=await saveListing("Clothes in mixed property store",fashion.id);assert.equal(moreClothes.status,303,"unrelated listings do not require property details");
    const householdAttributes={offering_type:"Cooking pots / casseroles",size_quantity:"3 pots, 2 L, 3 L and 5 L",item_details:"New stainless steel, lids included"};
    const householdResult=await saveListing("HTTP household pots",household.id,{trackStock:"true",stockQuantity:"8",attributesJson:JSON.stringify(householdAttributes)});
    assert.equal(householdResult.status,303,householdResult.text.slice(-500));
    const pots=await systemDb.one<{id:string;slug:string;kind:string;pricing_type:string;marketplace_category_id:string;category_id:string;attributes:Record<string,string>;track_stock:boolean;stock_quantity:number}>(`select * from products where store_id=$1 and name='HTTP household pots'`,[storeId]);
    assert.equal(pots.kind,"product");assert.equal(pots.pricing_type,"fixed");assert.equal(pots.marketplace_category_id,household.id);assert.equal(pots.category_id,sectionId);
    assert.deepEqual(pots.attributes,householdAttributes);assert.equal(pots.track_stock,true);assert.equal(pots.stock_quantity,8);
    assert.equal((await systemDb.one(`select count(*)::int n from store_category_assignments where store_id=$1 and category_id=$2`,[storeId,household.id])).n,1,"household listing adds the store's new business line");
    const householdEditPage=await http(`/vendor/products/${pots.id}`,cookie);assert.equal(householdEditPage.status,200);
    const householdEditForm=form(householdEditPage.text,"marketplaceCategoryId");
    assert.equal(householdEditForm.get("marketplaceCategoryId"),household.id);
    assert.equal(JSON.parse(String(householdEditForm.get("attributesJson"))).offering_type,householdAttributes.offering_type);
    householdEditForm.set("description","Revised household pot set description");
    assert.equal((await http(`/vendor/products/${pots.id}`,cookie,householdEditForm)).status,303);
    const editedPots=await systemDb.one(`select marketplace_category_id,category_id,attributes,stock_quantity,description from products where id=$1`,[pots.id]);
    assert.equal(editedPots.marketplace_category_id,household.id);assert.equal(editedPots.category_id,sectionId);assert.deepEqual(editedPots.attributes,householdAttributes);
    assert.equal(editedPots.stock_quantity,8);assert.equal(editedPots.description,"Revised household pot set description");
    const appointmentResult=await saveListing("HTTP appointment",beauty.id,{kind:"service"});assert.equal(appointmentResult.status,303);
    const inquiryResult=await saveListing("HTTP enquiry",enquiry.id,{kind:"service"});assert.equal(inquiryResult.status,303);
    const propertyResult=await saveListing("HTTP property",property.id,{kind:"service",attributesJson:JSON.stringify({listing_type:"For rent",property_type:"Flat / apartment",property_location:"10 Test Road in Uyo",price_period:"Per year",inspection_fee:"0"})});assert.equal(propertyResult.status,303);
    const extra=await systemDb.query<{id:string;slug:string;name:string;kind:string;pricing_type:string}>(`select id,slug,name,kind,pricing_type from products where store_id=$1`,[storeId]);
    const appointment=extra.find(row=>row.name==="HTTP appointment"),inquiry=extra.find(row=>row.name==="HTTP enquiry"),house=extra.find(row=>row.name==="HTTP property");assert(appointment&&inquiry&&house);
    assert.equal(inquiry.pricing_type,"quotation");
    console.log("PASS: actual settings save/removal safeguards, primary changes, per-listing property validation and enquiry-only pricing");

    // The same vendor's primary category is property/enquiry; appointments and
    // normal products must still use their own controls and booking profile.
    const bookPath=`/s/${slug}/book/${appointment.slug}`;
    page=await http(bookPath,cookie);assert.equal(page.status,200);assert(!page.text.includes("Select a time the agent"));
    const bookingForm=form(page.text,"meetingPreference");
    for(const [key,value] of Object.entries({customerName:"Local Booking Tester",customerEmail:"booking-category@example.test",customerPhone:"08031234567",meetingPreference:"vendor_location",requirementsAccepted:"on",date:new Date(Date.now()+7*86400000).toISOString().slice(0,10),time:"10:00"}))bookingForm.set(key,value);
    for(const field of getCategoryBookingProfile(beauty.slug).extraFields) if(field.required)bookingForm.set(`extra_${field.key}`,field.options?.[0] ?? "Fixture answer");
    const booked=await http(bookPath,cookie,bookingForm);assert.equal(booked.status,200);assert(booked.text.includes("Booking request sent"));
    const savedBooking=await systemDb.one(`select booking_details from service_bookings where store_id=$1 and product_id=$2`,[storeId,appointment.id]);
    assert.equal(savedBooking.booking_details.categorySlug,beauty.slug);
    const before=(await systemDb.one(`select count(*)::int n from service_bookings where store_id=$1`,[storeId])).n;
    bookingForm.set("productId",inquiry.id);
    assert((await http(bookPath,cookie,bookingForm)).text.includes("quotation enquiry"));
    bookingForm.set("productId",house.id);
    assert((await http(bookPath,cookie,bookingForm)).text.includes("available inspection slot"));
    assert.equal((await systemDb.one(`select count(*)::int n from service_bookings where store_id=$1`,[storeId])).n,before,"rejected booking submissions do not write bookings");
    const unavailableBookingPage = await http(`/s/${slug}/book/${inquiry.slug}`,cookie);
    // Next can stream the layout before notFound(), returning a 200 soft-404.
    assert(unavailableBookingPage.status === 404 || unavailableBookingPage.text.includes("find that page"));
    assert(!unavailableBookingPage.text.includes('name="meetingPreference"'), "enquiry-only listing has no appointment form");
    page=await http(`/s/${slug}/products/${clothes.slug}`,cookie);assert.equal(page.status,200);assert(page.text.includes("Add to cart"));assert(!page.text.includes("Book inspection"));
    page=await http(`/s/${slug}/products/${inquiry.slug}`,cookie);assert.equal(page.status,200);assert(!page.text.includes("Add to cart"));assert(page.text.includes("not an instant confirmed reservation"));
    page=await http(`/s/${slug}/products/${pots.slug}`,cookie);assert.equal(page.status,200);assert(page.text.includes("Add to cart"));assert(!page.text.includes("Book inspection"));assert(!page.text.includes("Book now"));
    for(const cat of [fashion,packaging,household]) {
      const listing=await http(`/stores?category=${cat.slug}&q=${encodeURIComponent(`HTTP Fixture ${slug}`)}`,cookie);assert.equal(listing.status,200);assert(listing.text.includes(`HTTP Fixture ${slug}`));
    }
    const householdBrowse=await http(`/browse?category=${household.slug}&kind=product&q=${encodeURIComponent(`HTTP Fixture ${slug}`)}`,cookie);
    assert.equal(householdBrowse.status,200);assert(householdBrowse.text.includes("HTTP household pots"));assert(!householdBrowse.text.includes("HTTP clothes"));
    const registrationCookie=`ivh_session_shared=${await createSessionToken({sub:registrationUserId,email:`register-${slug}@example.test`,role:"customer",name:"Registration Category Tester"})}`;
    const registerPage=await http("/register",registrationCookie);assert.equal(registerPage.status,200);
    const registerDom=new JSDOM(registerPage.text);
    assert(registerDom.window.document.querySelector(`#categorySlug option[value="${household.slug}"]`),"signed-in storefront registration offers Household Products");
    registerDom.window.close();
    console.log("PASS: household products persist through real create/edit forms, expand business categories and appear in registration, vendor discovery, product filters and Add to cart pages");
    assert((await http("/vendor/orders/export",cookie)).text.includes("Reference"));
    console.log("PASS: real booking actions use listing category, block forged enquiry/property requests, preserve clothing carts and render multi-category discovery");
    // Exercise aggregate category SQL in admin pages as well.
    const admin=await systemDb.one<{id:string;email:string;full_name:string}>(`select id,email,full_name from users where role in ('admin','super_admin') limit 1`);
    const adminCookie=`ivh_session_shared=${await createSessionToken({sub:admin.id,email:admin.email,role:"admin",name:admin.full_name})}`;
    for(const path of ["/admin","/admin/vendors",`/admin/vendors/${storeId}`,"/admin/messages","/admin/categories"])assert.equal((await http(path,adminCookie)).status,200,path);
    console.log("PASS: admin category counts and vendor category summaries render successfully");
  } finally {
    await withSystem(async db=>{
      await db.execute(`delete from stores where id=any($1::uuid[])`,[[storeId,otherStoreId]]);
      await db.execute(`delete from users where id=any($1::uuid[])`,[[userId,otherUserId,registrationUserId]]);
    });
    assert.equal((await systemDb.one(`select count(*)::int n from stores where id=any($1::uuid[])`,[[storeId,otherStoreId]])).n,0);
    assert.equal((await systemDb.one(`select count(*)::int n from users where id=any($1::uuid[])`,[[userId,otherUserId,registrationUserId]])).n,0);
  }
  console.log("PASS: local HTTP fixtures cleaned up");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
