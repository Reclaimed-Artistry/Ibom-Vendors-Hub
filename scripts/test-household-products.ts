/** Local rollback-only registration, discovery and physical-goods checkout coverage. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { systemDb, withSystem } from "../src/lib/db";
import { getBusinessCategories, saveBusinessCategories } from "../src/lib/business-categories";
import { directBooking } from "../src/lib/category-policy";
import { getOrderCategory } from "../src/lib/order-categories";
import { createCheckout } from "../src/lib/orders";
import { registerVendor } from "../src/lib/stores";
import { getCategoriesWithCounts, getMarketplaceStores, getStoreProduct, searchMarketplace } from "../src/lib/storefront";
import { sitemapForHost } from "../src/lib/seo-data";
import { productStructuredData } from "../src/lib/structured-data";
import { checkoutSchema, vendorRegisterSchema } from "../src/lib/validation";
import type { Store, StoreCategory } from "../src/lib/types";

async function main() {
  assert(["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5544/postgres").hostname), "Local database only");
  delete process.env.SMTP_HOST;
  process.env.NEXT_PUBLIC_APP_URL = "https://www.ibomvendorshub.com";
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = "ibomvendorshub.com";
  const counts = () => systemDb.one(`select (select count(*)::int from users) users, (select count(*)::int from stores) stores, (select count(*)::int from products) products, (select count(*)::int from orders) orders`);
  const before = await counts();
  const rollback = new Error("HOUSEHOLD_FIXTURE_ROLLBACK");
  try { await withSystem(async db => {
    const household = await db.one<StoreCategory>(`select * from store_categories where slug='household-products' and is_active`);
    const property = await db.one<StoreCategory>(`select * from store_categories where slug='house-agents-realtors'`);
    const enquiry = await db.one<StoreCategory>(`select * from store_categories where features->>'inquiryOnly'='true' limit 1`);
    const input = vendorRegisterSchema.parse({
      businessName: `Household Fixture ${randomUUID().slice(0, 8)}`, ownerName: "Household Tester",
      email: `household-${randomUUID()}@example.test`, password: "LocalFixture123!", phone: "08031234567",
      categorySlug: household.slug, categorySlugs: [household.slug, "general-retail", household.slug],
      description: "Local-only household products test fixture.", city: "Uyo", state: "Akwa Ibom", address: "10 Fixture Road, Uyo",
      nin: "12345678901", proofOfResidenceType: "utility_bill", proofOfResidenceUrl: "/fixture-document.pdf", cacRegistered: "no",
      bankName: "Fixture Bank", accountNumber: "0123456789", accountName: "Household Tester", acceptTerms: "on",
    });
    const registered = await registerVendor({ ...input, email: input.email! });
    assert.deepEqual((await getBusinessCategories(db, registered.storeId)).map(row => row.slug), [household.slug, "general-retail"]);
    assert.equal((await db.one(`select category_id from stores where id=$1`, [registered.storeId])).category_id, household.id);
    assert.equal(registered.trialEndsAt, null);
    const additional = await registerVendor({ ...input, email: `household-extra-${randomUUID()}@example.test`, businessName: `Extra Household ${randomUUID().slice(0, 8)}`, categorySlug: "general-retail", categorySlugs: [household.slug] });
    assert.deepEqual((await getBusinessCategories(db, additional.storeId)).map(row => row.slug), ["general-retail", household.slug]);
    console.log("PASS: Household Products works as a primary or additional business category; registration remains free and deduplicated");

    await db.execute(`update stores set status='active',visibility='public',manual_suspension=false,accepts_orders=true,accepts_delivery=true,accepts_pickup=true,delivery_fee=0,delivery_fee_outside=0,minimum_order=0 where id=$1`, [registered.storeId]);
    const section = await db.one<{ id: string }>(`insert into product_categories(store_id,name,slug) values($1,'My kitchen shelf','my-kitchen-shelf') returning id`, [registered.storeId]);
    const product = await db.one<{ id: string }>(`insert into products(store_id,category_id,marketplace_category_id,name,slug,kind,price,track_stock,stock_quantity,attributes)
      values($1,$2,$3,'Fixture stainless steel pot set','fixture-pot-set','product',12000,true,8,$4::jsonb) returning id`,
      [registered.storeId, section.id, household.id, JSON.stringify({ offering_type: "Cooking pots / casseroles", size_quantity: "3 pots, 2 L, 3 L and 5 L", item_details: "New stainless steel, lids included" })]);
    const variant = await db.one<{ id: string }>(`insert into product_variants(product_id,name,price,stock_quantity) values($1,'Silver, 3-piece set',12500,4) returning id`, [product.id]);
    await db.execute(`insert into product_images(product_id,url) values($1,'/images/seed/product-jollof.svg')`, [product.id]);
    const listing = await getStoreProduct(registered.storeId, "fixture-pot-set"); assert(listing);
    assert.equal(listing.marketplace_category?.id, household.id);
    assert.equal(listing.category_id, section.id);
    assert.equal(listing.images?.length, 1); assert.equal(listing.variants?.length, 1);
    assert(!directBooking(listing, property), "household goods are not inspections or appointments");
    const store = await db.one<Store>(`select * from stores where id=$1`, [registered.storeId]);
    assert(productStructuredData(listing, store, property).offers, "household goods expose a purchasable offer even with an unrelated fallback category");
    const found = await getMarketplaceStores({ categorySlug: household.slug, search: input.businessName });
    assert.equal(found.total, 1); assert.equal(found.stores[0].id, registered.storeId);
    assert.deepEqual((await searchMarketplace({ categorySlug: household.slug, search: input.businessName, kind: "product" })).products.map(row => row.id), [product.id]);
    assert.equal((await searchMarketplace({ categorySlug: "general-retail", search: input.businessName })).total, 0, "store membership must not put household listings in unrelated categories");
    assert((await getCategoriesWithCounts()).find(row => row.id === household.id)!.store_count >= 1);
    const sitemap = await sitemapForHost("www.ibomvendorshub.com");
    assert(sitemap.some(row => row.url.includes("/browse?category=household-products")));
    assert(sitemap.some(row => row.url.includes("/stores?category=household-products")));
    await db.execute(`update stores set manual_suspension=true where id=$1`, [registered.storeId]);
    assert.equal((await searchMarketplace({ categorySlug: household.slug, search: input.businessName })).total, 0);
    await db.execute(`update stores set manual_suspension=false where id=$1`, [registered.storeId]);
    console.log("PASS: household discovery, category counts/sitemaps, independent catalogue sections, media/variants, purchasable schema and suspended-store filtering");

    const customer = await db.one<{ id: string; email: string; fullName: string }>(`insert into users(email,full_name,role,email_verified_at) values($1,'Household Customer','customer',now()) returning id,email,full_name as "fullName"`, [`household-customer-${randomUUID()}@example.test`]);
    const checkout = (fulfilmentType: "pickup" | "delivery") => checkoutSchema.parse({
      items: [{ productId: product.id, variantId: variant.id, quantity: 2 }], customerName: customer.fullName, customerEmail: customer.email,
      customerPhone: "08031234567", bioAddress: "10 Test Road, Uyo", fulfilmentType,
      pickupLocation: "10 Fixture Road, Uyo", address: "10 Test Road", city: "Uyo", state: "Akwa Ibom",
    });
    for (const [primary, fulfilment] of [[property, "pickup"], [enquiry, "delivery"]] as const) {
      await saveBusinessCategories(db, registered.storeId, primary.slug, [household.slug, "general-retail", property.slug, enquiry.slug]);
      const purchase = await createCheckout(checkout(fulfilment), customer, "bank_transfer");
      assert.equal(purchase.total, 25000, "server uses the household variant price");
      const order = await db.one(`select fulfilment_type,payment_status from orders where id=$1`, [purchase.orders[0].id]);
      assert.equal(order.fulfilment_type, fulfilment); assert.equal(order.payment_status, "pending");
      const line = await db.one(`select marketplace_category_id,kind,unit_price,quantity,variant_id from order_items where order_id=$1`, [purchase.orders[0].id]);
      assert.equal(line.marketplace_category_id, household.id); assert.equal(line.kind, "product");
      assert.equal(Number(line.unit_price), 12500); assert.equal(line.quantity, 2); assert.equal(line.variant_id, variant.id);
      assert.equal((await getOrderCategory(purchase.orders[0].id, primary.id))?.slug, household.slug);
    }
    await db.execute(`update product_variants set stock_quantity=1 where id=$1`, [variant.id]);
    await assert.rejects(createCheckout(checkout("pickup"), customer, "bank_transfer"), /Only 1 left/);
    await db.execute(`update product_variants set stock_quantity=4 where id=$1`, [variant.id]);
    await db.execute(`update products set is_available=false where id=$1`, [product.id]);
    await assert.rejects(createCheckout(checkout("pickup"), customer, "bank_transfer"), /currently unavailable/);
    console.log("PASS: actual household pickup/delivery checkouts, variant prices/stock and unavailable-item guards follow the listing, not property/enquiry store primaries");
    throw rollback;
  }); } catch (error) { if (error !== rollback) throw error; }
  assert.deepEqual(await counts(), before, "all household users, stores, products and orders rolled back");
  console.log("PASS: all household fixtures rolled back; no real inventory or orders created");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
