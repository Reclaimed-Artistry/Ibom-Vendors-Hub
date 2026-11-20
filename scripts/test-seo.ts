import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "../src/middleware";
import { systemDb, withSystem } from "../src/lib/db";
import {
  crawlerContext, isNonIndexablePath, listingCanonical, listingPage, publicMetadata,
  robotsForHost, seoDescription, serializeJsonLd, siteUrl, siteVerification, storeUrl,
} from "../src/lib/seo";
import { sitemapForHost } from "../src/lib/seo-data";
import { breadcrumbStructuredData, productStructuredData, storeStructuredData, websiteStructuredData } from "../src/lib/structured-data";
import type { Product, Store, StoreCategory } from "../src/lib/types";
import { ORGANIZATION_LOGO } from "../src/lib/brand-assets";

process.env.NEXT_PUBLIC_APP_URL = "https://www.ibomvendorshub.com";
process.env.NEXT_PUBLIC_ROOT_DOMAIN = "ibomvendorshub.com";

async function main() {
  assert.equal(siteUrl(), "https://www.ibomvendorshub.com/");
  assert.equal(storeUrl("royalfashionboutique", "/products/ankara"), "https://royalfashionboutique.ibomvendorshub.com/products/ankara");
  assert.equal(listingCanonical(siteUrl("/browse"), { category: "fashion-clothing", page: "2", kind: "product" }), "https://www.ibomvendorshub.com/browse?category=fashion-clothing&kind=product&page=2");
  assert.equal(listingCanonical(siteUrl("/browse"), { page: "1" }), siteUrl("/browse"));
  for (const value of [undefined, "0", "-1", "NaN", "Infinity", "1.5", "9007199254740993"]) assert.equal(listingPage(value), 1);
  assert.equal(seoDescription("<b>Local</b>   vendor\n catalogue"), "Local vendor catalogue");
  assert(seoDescription("A useful description ".repeat(30)).length <= 160);
  assert.equal(crawlerContext("project.vercel.app").indexable, false);
  assert.equal(crawlerContext("www.ibomvendorshub.com.evil.test").indexable, false);
  assert.equal(crawlerContext("admin.ibomvendorshub.com").indexable, false);
  assert.equal(robotsForHost("www.ibomvendorshub.com").sitemap, "https://www.ibomvendorshub.com/sitemap.xml");
  assert.equal(robotsForHost("royalfashionboutique.ibomvendorshub.com").sitemap, "https://royalfashionboutique.ibomvendorshub.com/sitemap.xml");
  assert.deepEqual(robotsForHost("preview.vercel.app").rules, [{ userAgent: "*", disallow: "/" }]);

  for (const path of ["/admin", "/vendor/products", "/account/orders/123", "/api/health", "/auth/google", "/login", "/register/customer", "/verify-email", "/reset-password", "/pay/ref", "/cart", "/checkout", "/track", "/book/service", "/s/royalfashionboutique/quote/ankara"]) {
    assert(isNonIndexablePath(path), path);
    const response = middleware(new NextRequest(`https://www.ibomvendorshub.com${path}`, { headers: { host: "www.ibomvendorshub.com" } }));
    assert(response.headers.get("x-robots-tag")?.includes("noindex"), path);
  }
  for (const path of ["/", "/browse", "/stores", "/about", "/sell", "/products/ankara"]) assert(!isNonIndexablePath(path), path);
  for (const host of ["www.ibomvendorshub.com", "royalfashionboutique.ibomvendorshub.com"]) {
    for (const path of ["/robots.txt", "/sitemap.xml"]) {
      const response = middleware(new NextRequest(`https://${host}${path}`, { headers: { host } }));
      assert.equal(response.headers.get("x-middleware-rewrite"), null, `${host}${path}`);
      assert.equal(response.headers.get("x-robots-tag"), null, `${host}${path}`);
    }
  }
  const marketplace = middleware(new NextRequest("https://royalfashionboutique.ibomvendorshub.com/browse?category=fashion-clothing", { headers: { host: "royalfashionboutique.ibomvendorshub.com" } }));
  assert.equal(marketplace.status, 308);
  assert.equal(marketplace.headers.get("location"), "https://www.ibomvendorshub.com/browse?category=fashion-clothing");
  const preview = middleware(new NextRequest("https://project.vercel.app/", { headers: { host: "project.vercel.app" } }));
  assert(preview.headers.get("x-robots-tag")?.includes("noindex"));
  const search = middleware(new NextRequest("https://www.ibomvendorshub.com/browse?q=shirt", { headers: { host: "www.ibomvendorshub.com" } }));
  assert.equal(search.headers.get("x-robots-tag"), "noindex, follow");

  const input = { name: "Vendor </script><script>alert(1)</script>\u2028" };
  const encoded = serializeJsonLd(input);
  assert(!encoded.includes("<"));
  assert.deepEqual(JSON.parse(encoded), input);
  const meta = publicMetadata({ title: "A vendor", description: "A description", url: storeUrl("vendor-one"), image: "javascript:alert(1)" });
  assert.equal(meta.alternates?.canonical, storeUrl("vendor-one"));
  assert(JSON.stringify(meta).includes("/brand/og-image.png"));
  const oldGoogle = process.env.GOOGLE_SITE_VERIFICATION;
  const oldBing = process.env.BING_SITE_VERIFICATION;
  try {
    delete process.env.GOOGLE_SITE_VERIFICATION;
    delete process.env.BING_SITE_VERIFICATION;
    assert.deepEqual(siteVerification(), {}, "never fabricate site verification");
    process.env.GOOGLE_SITE_VERIFICATION = "google-test-token";
    process.env.BING_SITE_VERIFICATION = "bing-test-token";
    assert.deepEqual(siteVerification(), { google: "google-test-token", other: { "msvalidate.01": "bing-test-token" } });
  } finally {
    if (oldGoogle === undefined) delete process.env.GOOGLE_SITE_VERIFICATION; else process.env.GOOGLE_SITE_VERIFICATION = oldGoogle;
    if (oldBing === undefined) delete process.env.BING_SITE_VERIFICATION; else process.env.BING_SITE_VERIFICATION = oldBing;
  }
  const website = websiteStructuredData("support@example.test");
  assert.equal(website["@graph"][0].name, "Ibom Vendors Hub");
  const logo = website["@graph"][0].logo!;
  assert.equal(logo["@type"], "ImageObject");
  assert.equal(logo["@id"], siteUrl("/#logo"));
  assert.equal(logo.url, siteUrl(ORGANIZATION_LOGO.path));
  assert.equal(logo.contentUrl, logo.url);
  assert.equal(logo.width, ORGANIZATION_LOGO.width);
  assert.equal(logo.height, ORGANIZATION_LOGO.height);
  assert.equal(website["@graph"][1].publisher?.["@id"], website["@graph"][0]["@id"], "WebSite publisher identifies the organization carrying the full logo");
  assert.equal(breadcrumbStructuredData([{ name: "Store", url: storeUrl("store-one") }]).itemListElement[0].position, 1);
  console.log("PASS: SEO URLs, robots, private routes, preview protection, snippets, verification and safe JSON-LD");

  const dbHost = new URL(process.env.DATABASE_URL || "postgres://postgres@127.0.0.1:5544/postgres").hostname;
  assert(["127.0.0.1", "localhost"].includes(dbHost), "Mutating SEO tests must use the local fixture database");
  const store = await systemDb.one<Store>(`select * from stores where store_is_live(id) and exists (select 1 from products where store_id = stores.id and is_available) order by slug limit 1`);
  const product = await systemDb.one<Product>(`select * from products where store_id = $1 and is_available order by slug limit 1`, [store.id]);
  const category = store.category_id ? await systemDb.maybeOne<StoreCategory>(`select * from store_categories where id = $1`, [store.category_id]) : null;
  const fixed = { ...product, kind: "product" as const, pricing_type: "fixed" as const, price: 12000, currency: "NGN", is_available: true, track_stock: true, stock_quantity: 2, made_to_order: false, rating_count: 0 };
  const schema = productStructuredData(fixed, { ...store, accepts_orders: true }, null);
  assert.equal(schema["@type"], "Product");
  assert.equal(schema.offers?.price, "12000.00");
  assert.equal(schema.offers?.availability, "https://schema.org/InStock");
  assert.equal(schema.aggregateRating, undefined);
  assert.equal(productStructuredData({ ...fixed, stock_quantity: 0 }, store, null).offers?.availability, "https://schema.org/OutOfStock");
  assert.equal(productStructuredData({ ...fixed, made_to_order: true }, { ...store, accepts_orders: true }, null).offers?.availability, "https://schema.org/PreOrder");
  for (const pricing_type of ["from", "quotation"] as const) assert.equal(productStructuredData({ ...fixed, pricing_type }, store, null).offers, undefined);
  assert.equal(productStructuredData(fixed, store, { ...category, features: { inquiryOnly: true } } as StoreCategory).offers, undefined);
  assert.equal(productStructuredData(fixed, store, { ...category, features: { propertyListings: true } } as StoreCategory).offers, undefined);
  assert.equal(productStructuredData({ ...fixed, kind: "service" }, store, null)["@type"], "Service");
  assert.equal(productStructuredData({ ...fixed, rating_count: 2, rating_avg: 4.5 }, store, null).aggregateRating?.reviewCount, 2);
  assert.equal(storeStructuredData({ ...store, address: null }, category)["@type"], "Organization");
  console.log("PASS: factual Product/Service/business schema; no invented reviews, enquiry offers or starting prices");

  const root = await sitemapForHost("www.ibomvendorshub.com");
  assert(root.some((entry) => entry.url === siteUrl("/sell")));
  assert(root.every((entry) => new URL(entry.url).host === "www.ibomvendorshub.com"), "root sitemap is single-host");
  assert(root.every((entry) => !isNonIndexablePath(new URL(entry.url).pathname)));
  assert.equal(new Set(root.map((entry) => entry.url)).size, root.length);
  const tenantHost = `${store.slug}.ibomvendorshub.com`;
  const tenant = await sitemapForHost(tenantHost);
  assert(tenant.some((entry) => entry.url === storeUrl(store.slug)));
  assert(tenant.some((entry) => entry.url === storeUrl(store.slug, `/products/${product.slug}`)));
  assert(tenant.every((entry) => new URL(entry.url).host === tenantHost));
  assert.deepEqual(await sitemapForHost("missing-seo-fixture.ibomvendorshub.com"), []);
  assert.deepEqual(await sitemapForHost("project.vercel.app"), []);

  const rollback = new Error("SEO_TEST_ROLLBACK");
  try {
    await withSystem(async (db) => {
      await db.execute(`update products set is_available = false where id = $1`, [product.id]);
      assert(!(await sitemapForHost(tenantHost)).some((entry) => entry.url === storeUrl(store.slug, `/products/${product.slug}`)), "unavailable products leave sitemap");
      for (const [status, manual, visibility] of [
        ["pending", false, "public"], ["suspended", false, "public"], ["rejected", false, "public"],
        ["active", true, "public"], ["active", false, "unlisted"],
      ]) {
        await db.execute(`update stores set status = $2, manual_suspension = $3, visibility = $4 where id = $1`, [store.id, status, manual, visibility]);
        assert.deepEqual(await sitemapForHost(tenantHost), [], `${status}/${manual}/${visibility} must not be indexed`);
      }
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
  assert((await sitemapForHost(tenantHost)).some((entry) => entry.url === storeUrl(store.slug, `/products/${product.slug}`)), "rollback restored fixture");
  console.log(`PASS: live single-host sitemaps (${root.length} platform URLs, ${tenant.length} fixture vendor URLs); offline/unlisted/unavailable exclusions and rollback`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
