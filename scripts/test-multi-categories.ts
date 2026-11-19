/** Local, rollback-only coverage for marketplace categories vs catalogue sections. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { systemDb, withSystem, type Db } from "../src/lib/db";
import { addProductBusinessCategory, getBusinessCategories, saveBusinessCategories, validateBusinessCategories } from "../src/lib/business-categories";
import { categorySlugs, directBooking, listingCategory, storeFeatures } from "../src/lib/category-policy";
import { getOrderCategory } from "../src/lib/order-categories";
import { registerVendor } from "../src/lib/stores";
import { createCheckout, getOrderForActor, getVendorOrderList } from "../src/lib/orders";
import { getCategoriesWithCounts, getMarketplaceStores, getStoreProduct, getStoreProducts, searchMarketplace, workflowFor } from "../src/lib/storefront";
import { sitemapForHost } from "../src/lib/seo-data";
import { productStructuredData } from "../src/lib/structured-data";
import { productGuide } from "../src/lib/product-guide";
import { addInspectionSlot } from "../src/lib/property-inspections";
import { checkoutSchema, productSchema, vendorRegisterSchema } from "../src/lib/validation";
import type { Product, Store, StoreCategory } from "../src/lib/types";

async function rejectedSql(db: Db, work: () => Promise<unknown>, pattern: RegExp) {
  await db.execute("savepoint category_expected_failure");
  try { await assert.rejects(work, pattern); }
  finally { await db.execute("rollback to savepoint category_expected_failure"); await db.execute("release savepoint category_expected_failure"); }
}

async function actor(db: Db, id: string | null, role = "vendor") {
  await db.execute("reset role");
  await db.execute("select set_config('app.user_id',$1,true),set_config('app.user_role',$2,true)", [id ?? "", role]);
  await db.execute("set local role app_runtime");
  assert.equal((await db.one(`select current_user as name`)).name, "app_runtime", "RLS checks really use the runtime role, even inside rollback fixtures");
}

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5544/postgres").hostname;
  assert(["localhost", "127.0.0.1"].includes(host), "Only run against the local fixture database");
  delete process.env.SMTP_HOST;
  process.env.NEXT_PUBLIC_APP_URL = "https://www.ibomvendorshub.com";
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = "ibomvendorshub.com";
  assert.deepEqual(categorySlugs("fashion-clothing", ["branding-packaging", "fashion-clothing", "branding-packaging"]), ["fashion-clothing", "branding-packaging"]);
  assert(!productSchema.safeParse({ name: "Test", price: 100, marketplaceCategoryId: "not-a-uuid" }).success);

  const before = await systemDb.one<{ n: number }>(`select count(*)::int as n from stores`);
  const rollback = new Error("MULTI_CATEGORY_ROLLBACK");
  try { await withSystem(async db => {
    const taxonomy = await db.query<StoreCategory>(`select * from store_categories where is_active`);
    const find = (slug: string) => { const category = taxonomy.find(row => row.slug === slug); assert(category, slug); return category; };
    const fashion = find("fashion-clothing"), packaging = find("branding-packaging"), property = find("house-agents-realtors"), beauty = find("beauty-personal-care");
    const enquiry = taxonomy.find(category => category.features.inquiryOnly); assert(enquiry);
    const inactive = await db.one<{ id: string }>(`insert into store_categories(name,slug,is_active) values('Unavailable test category',$1,false) returning id`, [`unavailable-${randomUUID()}`]);

    const input = vendorRegisterSchema.parse({
      businessName: `Multi Category Fixture ${randomUUID()}`, ownerName: "Local Category Tester",
      email: `categories-${randomUUID()}@example.test`, password: "LocalFixture123!", phone: "08031234567",
      categorySlug: fashion.slug, categorySlugs: [fashion.slug, packaging.slug, packaging.slug],
      description: "Clothes, custom branding and packaging for local fixture tests.", city: "Uyo", state: "Akwa Ibom", address: "10 Fixture Road, Uyo",
      nin: "12345678901", proofOfResidenceType: "utility_bill", proofOfResidenceUrl: "/fixture-document.pdf", cacRegistered: "no",
      bankName: "Fixture Bank", accountNumber: "0123456789", accountName: "Local Category Tester", acceptTerms: "on",
    });
    const registered = await registerVendor({ ...input, email: input.email! });
    let selected = await getBusinessCategories(db, registered.storeId);
    assert.deepEqual(selected.map(row => row.slug), [fashion.slug, packaging.slug]);
    assert.equal((await db.one(`select category_id from stores where id=$1`, [registered.storeId])).category_id, fashion.id);
    assert.equal(registered.trialEndsAt, null, "multi-category registration is still free, not a trial");
    assert.equal((await db.one(`select count(*)::int n from subscriptions where store_id=$1`, [registered.storeId])).n, 0);
    const invalidEmail = `categories-invalid-${randomUUID()}@example.test`;
    await assert.rejects(registerVendor({ ...input, email: invalidEmail, businessName: `Invalid Category ${randomUUID()}`, categorySlugs: ["missing-category"] }), /categor/i);
    assert.equal((await db.one(`select count(*)::int n from users where email=$1`, [invalidEmail])).n, 0, "invalid registration writes nothing");
    await assert.rejects(validateBusinessCategories(db, fashion.slug, ["missing-category"]), /categor/i);
    await assert.rejects(addProductBusinessCategory(db, registered.storeId, inactive.id), /valid marketplace category/);
    const legacy = await registerVendor({ ...input, email: `categories-legacy-${randomUUID()}@example.test`, businessName: `Single Category Fixture ${randomUUID()}`, categorySlugs: undefined });
    assert.equal((await getBusinessCategories(db, legacy.storeId)).length, 1, "legacy single-category registration works");
    console.log("PASS: actual multi/single registration, primary category, deduplication, invalid-category rollback, active-category validation and free access");

    await db.execute(`update stores set status='active',visibility='public',manual_suspension=false,accepts_orders=true,accepts_pickup=true,minimum_order=0 where id=$1`, [registered.storeId]);
    const section = await db.one<{ id: string }>(`insert into product_categories(store_id,name,slug) values($1,'My private section','my-private-section') returning id`, [registered.storeId]);
    const otherSection = await db.one<{ id: string }>(`insert into product_categories(store_id,name,slug) values($1,'Other store section','other-section') returning id`, [legacy.storeId]);
    const ids: Record<string, string> = {};
    const add = async (key: string, categoryId?: string, kind = "product", attributes = {}) => {
      const id = randomUUID(); ids[key] = id;
      await db.execute(`insert into products(id,store_id,category_id,marketplace_category_id,name,slug,kind,price,attributes,is_available)
        values($1,$2,$3,$4,$5,$6,$7,1000,$8::jsonb,true)`, [id,registered.storeId,section.id,categoryId ?? null,`Fixture ${key}`,`${key}-${id}`,kind,JSON.stringify(attributes)]);
      return id;
    };
    await add("clothes");
    await add("boxes", packaging.id);
    assert.equal((await db.one(`select marketplace_category_id from products where id=$1`, [ids.clothes])).marketplace_category_id, fashion.id, "old inserts default to primary category");
    await saveBusinessCategories(db, registered.storeId, packaging.slug, [fashion.slug]);
    assert.equal((await db.one(`select marketplace_category_id from products where id=$1`, [ids.clothes])).marketplace_category_id, fashion.id, "changing primary does not recategorise existing products");
    await db.execute(`insert into product_variants(product_id,name,price) values($1,'Large',1500)`, [ids.boxes]);
    await db.execute(`insert into product_images(product_id,url) values($1,'/images/seed/product-jollof.svg')`, [ids.boxes]);
    const boxes = await getStoreProduct(registered.storeId, `boxes-${ids.boxes}`); assert(boxes);
    assert.equal(boxes.category_id, section.id);
    assert.equal(boxes.marketplace_category?.slug, packaging.slug);
    assert.equal(boxes.variants?.length, 1); assert.equal(boxes.images?.length, 1);
    assert((await getStoreProducts({storeId:registered.storeId,categoryId:section.id})).products.some(row => row.id === ids.boxes), "catalogue section filtering is unchanged");
    await assert.rejects(saveBusinessCategories(db, registered.storeId, packaging.slug, []), /still have listings/);
    await rejectedSql(db, () => db.execute(`update products set category_id=$2 where id=$1`, [ids.boxes, otherSection.id]), /own store/);
    console.log("PASS: existing product defaults, primary changes, catalogue sections, variants/images, effective category reads and safe category removal");

    const marker = registered.slug;
    for (const category of [fashion, packaging]) {
      const stores = await getMarketplaceStores({categorySlug:category.slug,search:input.businessName});
      assert.equal(stores.stores.filter(row => row.id === registered.storeId).length, 1, "store appears exactly once in each category");
      assert.equal(stores.total, 1);
      assert.equal(stores.stores[0].business_categories?.length, 2);
      assert(stores.stores[0].category_name?.includes("Branding"));
    }
    const fashionProducts = await searchMarketplace({categorySlug:fashion.slug,search:input.businessName});
    assert.deepEqual(fashionProducts.products.map(row => row.id), [ids.clothes]);
    const packagingProducts = await searchMarketplace({categorySlug:packaging.slug,search:input.businessName});
    assert.deepEqual(packagingProducts.products.map(row => row.id), [ids.boxes]);
    assert.equal(new Set((await searchMarketplace({search:input.businessName})).products.map(row => row.id)).size, 2);
    const counts = await getCategoriesWithCounts();
    assert((counts.find(row => row.id === fashion.id)?.store_count ?? 0) >= 1);
    assert((counts.find(row => row.id === packaging.id)?.store_count ?? 0) >= 1);
    const sitemap = await sitemapForHost("www.ibomvendorshub.com");
    for (const category of [fashion, packaging]) {
      assert(sitemap.some(row => row.url.includes(`/stores?category=${category.slug}`)));
      assert(sitemap.some(row => row.url.includes(`/browse?category=${category.slug}`)));
    }
    for (const [status,manual,visibility] of [["pending",false,"public"],["active",true,"public"],["active",false,"unlisted"],["rejected",false,"public"]]) {
      await db.execute(`update stores set status=$2,manual_suspension=$3,visibility=$4 where id=$1`, [registered.storeId,status,manual,visibility]);
      assert(!(await getMarketplaceStores({categorySlug:packaging.slug,search:input.businessName})).stores.some(row => row.id === registered.storeId));
      assert(!(await searchMarketplace({categorySlug:packaging.slug,search:input.businessName})).products.some(row => row.store_id === registered.storeId));
      assert.deepEqual(await sitemapForHost(`${marker}.ibomvendorshub.com`), []);
    }
    await db.execute(`update stores set status='active',manual_suspension=false,visibility='public' where id=$1`, [registered.storeId]);
    console.log("PASS: discovery in every selected category, accurate product category filters, no duplicate rows/counts and live-only sitemaps");

    // Adding a listing in a new business line must not require re-registering.
    for (const category of [property, enquiry, beauty]) await addProductBusinessCategory(db, registered.storeId, category.id);
    await add("house", property.id, "service", {listing_type:"For rent",property_type:"Flat / apartment",property_location:"10 Test Road, Uyo",price_period:"Per year",inspection_fee:"0"});
    await add("enquiry", enquiry.id, "service");
    await add("appointment", beauty.id, "service");
    selected = await getBusinessCategories(db, registered.storeId);
    assert.equal(selected.length, 5);
    assert(storeFeatures(selected).cart, "cart stays in navigation when an unrelated enquiry/property category is added");
    const clothes = await getStoreProduct(registered.storeId, `clothes-${ids.clothes}`); assert(clothes);
    assert.equal(listingCategory(clothes)?.slug, fashion.slug);
    assert(!listingCategory(clothes)?.features.inquiryOnly);
    assert(!listingCategory(clothes)?.features.propertyListings);
    assert.equal(productGuide(listingCategory(boxes)?.slug).choices.some(choice => /bag/i.test(choice)), true);
    const appointment = await getStoreProduct(registered.storeId, `appointment-${ids.appointment}`); assert(appointment);
    assert(directBooking(appointment, property));
    const inquiryProduct = await getStoreProduct(registered.storeId, `enquiry-${ids.enquiry}`); assert(inquiryProduct);
    assert(!directBooking(inquiryProduct, beauty));
    const store = await db.one<Store>(`select * from stores where id=$1`, [registered.storeId]);
    assert(productStructuredData(clothes, store, property).offers, "clothes retain their own purchasable schema");
    assert(!productStructuredData(inquiryProduct, store, fashion).offers);
    const localTime = new Date(Date.now()+5*86400000).toISOString().slice(0,16);
    await assert.rejects(addInspectionSlot(registered.userId,ids.clothes,localTime,60,"office","10 Test Road, Uyo"), /Property not found/);
    await addInspectionSlot(registered.userId,ids.house,localTime,60,"office","10 Test Road, Uyo");
    const customer = await db.one<{ id:string;email:string;fullName:string }>(`select id,email,full_name as "fullName" from users where role='customer' limit 1`);
    const checkout = (items: string[]) => checkoutSchema.parse({ items:items.map(productId => ({productId,quantity:1})),customerName:customer.fullName,customerEmail:customer.email,customerPhone:"08031234567",bioAddress:"10 Test Road, Uyo",fulfilmentType:"pickup",pickupLocation:"10 Fixture Road, Uyo" });
    for (const primary of [property, enquiry]) {
      await saveBusinessCategories(db,registered.storeId,primary.slug,selected.map(row => row.slug));
      await createCheckout(checkout([ids.clothes]),customer,"bank_transfer");
    }
    await assert.rejects(createCheckout(checkout([ids.house]),customer,"bank_transfer"), /Properties cannot be purchased/);
    await assert.rejects(createCheckout(checkout([ids.enquiry]),customer,"bank_transfer"), /quotation enquiry/);
    await assert.rejects(createCheckout(checkout([ids.clothes,ids.enquiry]),customer,"bank_transfer"), /quotation enquiry/);
    const mixedOrder = await createCheckout(checkout([ids.clothes,ids.boxes]),customer,"bank_transfer");
    const orderId = mixedOrder.orders[0].id;
    const effective = await getOrderCategory(orderId, property.id);
    assert.equal(effective?.slug, "mixed-category-order");
    assert(workflowFor(effective).some(stage => stage.key === "in_production"));
    await db.execute(`update products set marketplace_category_id=$2 where id=$1`,[ids.boxes,fashion.id]);
    assert.equal((await getOrderCategory(orderId,property.id))?.slug,"mixed-category-order","recategorising a product does not change an existing order workflow");
    await db.execute(`update products set marketplace_category_id=$2 where id=$1`,[ids.boxes,packaging.id]);
    const detail = await getOrderForActor(orderId,{id:registered.userId,role:"vendor",email:input.email!});
    assert.equal(detail?.category?.slug,"mixed-category-order");
    assert((await getVendorOrderList(registered.storeId,{})).orders.some(order => order.id === orderId && order.workflow_category?.slug === "mixed-category-order"));
    console.log("PASS: adding new categories from products, per-listing guides/features/schema, inspection ownership/type checks, mixed-store checkout isolation and order workflows");

    // Really switch to the RLS role: nested withPublic/withActor alone would
    // inherit this test's outer system transaction and give false positives.
    await db.execute(`update store_categories set is_active=false where id=$1`, [packaging.id]);
    await actor(db, registered.userId);
    await saveBusinessCategories(db,registered.storeId,enquiry.slug,selected.map(row=>row.slug));
    await addProductBusinessCategory(db,registered.storeId,packaging.id,ids.boxes);
    await assert.rejects(addProductBusinessCategory(db,registered.storeId,packaging.id), /valid marketplace category/);
    await db.execute(`update products set marketplace_category_id=$2 where id=$1`, [ids.boxes,packaging.id]);
    await rejectedSql(db, () => db.execute(`update stores set category_id=$2 where id=$1`, [registered.storeId,inactive.id]), /active primary/);
    await addProductBusinessCategory(db,registered.storeId,beauty.id);
    await rejectedSql(db, () => addProductBusinessCategory(db,legacy.storeId,beauty.id), /row|found|result/i);
    await rejectedSql(db, () => db.execute(`insert into store_category_assignments(store_id,category_id) values($1,$2)`, [legacy.storeId,beauty.id]), /row-level security/);
    await rejectedSql(db, () => db.execute(`insert into store_category_assignments(store_id,category_id) values($1,$2)`, [registered.storeId,inactive.id]), /row-level security/);
    assert.equal(await db.execute(`delete from store_category_assignments where store_id=$1`, [legacy.storeId]), 0);
    await rejectedSql(db, async () => {
      await db.execute(`delete from store_category_assignments where store_id=$1 and category_id=$2`, [registered.storeId,fashion.id]);
      await db.execute("set constraints all immediate");
    }, /foreign key/);
    await db.execute("reset role");
    await db.execute(`update stores set status='pending' where id=$1`, [legacy.storeId]);
    await actor(db, null, "anon");
    assert.equal((await db.one(`select count(*)::int n from store_category_assignments where store_id=$1`, [legacy.storeId])).n, 0);
    assert((await db.one(`select count(*)::int n from store_category_assignments where store_id=$1`, [registered.storeId])).n > 0);
    assert.equal((await getStoreProduct(registered.storeId,`boxes-${ids.boxes}`))?.marketplace_category?.slug,packaging.slug,"hiding a category does not remove existing listing rules");
    await db.execute("reset role");
    await db.execute("select set_config('app.user_role','system',true)");
    await db.execute(`update store_categories set is_active=true where id=$1`, [packaging.id]);
    // Removing an unused extra category works; deleting a store cascades safely
    // despite the deferred primary-membership constraint.
    await saveBusinessCategories(db,legacy.storeId,fashion.slug,[packaging.slug]);
    await saveBusinessCategories(db,legacy.storeId,fashion.slug,[]);
    assert.equal((await getBusinessCategories(db,legacy.storeId)).length,1);
    await db.execute(`delete from stores where id=$1`, [legacy.storeId]);
    await db.execute("set constraints all immediate");
    console.log("PASS: real RLS ownership, inactive-category rejection, anonymous visibility, used-category FK guard, unused-category removal and cascade deletion");
    throw rollback;
  }); } catch (error) { if (error !== rollback) throw error; }
  assert.equal((await systemDb.one<{ n: number }>(`select count(*)::int n from stores`)).n,before.n,"all fixture stores rolled back");
  console.log("PASS: all multi-category fixtures rolled back");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
