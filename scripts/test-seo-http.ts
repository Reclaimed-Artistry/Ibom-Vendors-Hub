import assert from "node:assert/strict";
import { request } from "node:http";
import { systemDb } from "../src/lib/db";

const BASE = process.env.SEO_TEST_BASE_URL ?? "http://127.0.0.1:3010";
const ROOT = "www.ibomvendorshub.com";
const publicOrigin = `https://${ROOT}`;

function decode(value: string) {
  return value.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
}
function canonical(html: string) {
  const links = [...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"[^>]*>/g)];
  assert.equal(links.length, 1, "one canonical URL per page");
  return new URL(decode(links[0][1])).toString();
}
function title(html: string) {
  const titles = [...html.matchAll(/<title>([^<]*)<\/title>/g)];
  assert.equal(titles.length, 1, "one search title per page");
  return decode(titles[0][1]);
}
function schemas(html: string): Array<Record<string, any>> {
  return [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
}
function get(path: string, host = ROOT): Promise<{ response: { status: number; headers: Headers }; text: string }> {
  // Node fetch can silently replace Host. A raw local HTTP request is needed
  // to exercise the real wildcard middleware without external wildcard DNS.
  return new Promise((resolve, reject) => {
    const req = request(new URL(path, BASE), { headers: { host, "user-agent": "Googlebot" } }, (res) => {
      const headers = new Headers();
      for (const [key, value] of Object.entries(res.headers)) {
        if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
      }
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { text += chunk; });
      res.on("end", () => resolve({ response: { status: res.statusCode ?? 0, headers }, text }));
      res.on("error", reject);
    });
    req.setTimeout(30000, () => req.destroy(new Error(`Timed out: ${path}`)));
    req.on("error", reject);
    req.end();
  });
}

async function main() {
  const robots = await get("/robots.txt");
  assert.equal(robots.response.status, 200);
  assert(robots.response.headers.get("content-type")?.includes("text/plain"));
  assert(robots.text.includes(`Sitemap: ${publicOrigin}/sitemap.xml`));
  assert(robots.text.includes("Allow: /"));
  assert(!robots.text.includes("Disallow: /_next"));
  assert.equal(robots.response.headers.get("x-robots-tag"), null);

  const sitemap = await get("/sitemap.xml");
  assert.equal(sitemap.response.status, 200);
  assert(sitemap.response.headers.get("content-type")?.includes("xml"));
  const urls = [...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decode(match[1]));
  assert(urls.includes(`${publicOrigin}/sell`));
  assert(urls.every((url) => new URL(url).host === ROOT));
  assert(urls.every((url) => !url.includes("/s/")));

  const home = await get("/");
  assert.equal(home.response.status, 200);
  assert.equal(home.response.headers.get("x-robots-tag"), null);
  assert.equal(canonical(home.text), `${publicOrigin}/`);
  assert(title(home.text).includes("Shop Akwa Ibom Businesses Online"));
  assert(schemas(home.text).some((schema) => schema["@graph"]?.some((node: any) => node["@type"] === "Organization")));
  assert(/property="og:url" content="https:\/\/www\.ibomvendorshub\.com\/?"/.test(home.text));

  const sell = await get("/sell");
  assert.equal(sell.response.status, 200);
  assert.equal(canonical(sell.text), `${publicOrigin}/sell`);
  assert(schemas(sell.text).some((schema) => schema["@type"] === "FAQPage"));
  assert(sell.text.includes("No trial countdown or subscription payment is required"));

  const category = await get("/browse?category=fashion-clothing&sort=price_asc&utm_source=test");
  assert.equal(category.response.status, 200);
  assert.equal(canonical(category.text), `${publicOrigin}/browse?category=fashion-clothing`);
  assert(title(category.text).includes("Fashion & Clothing in Akwa Ibom"));
  const pageTwo = await get("/browse?page=2&sort=price_desc");
  assert.equal(canonical(pageTwo.text), `${publicOrigin}/browse?page=2`);
  const search = await get("/browse?q=shirt");
  assert(search.response.headers.get("x-robots-tag")?.includes("noindex"));
  assert(/name="robots" content="noindex, follow"/.test(search.text));

  const store = await systemDb.one<{ slug: string; name: string; product_slug: string; product_name: string }>(
    `select s.slug, s.name, p.slug as product_slug, p.name as product_name
       from stores s join products p on p.store_id = s.id
      where store_is_live(s.id) and p.is_available order by s.slug, p.slug limit 1`,
  );
  const host = `${store.slug}.ibomvendorshub.com`;
  const origin = `https://${host}`;
  const vendorRobots = await get("/robots.txt", host);
  assert.equal(vendorRobots.response.status, 200);
  assert(vendorRobots.text.includes(`Sitemap: ${origin}/sitemap.xml`));
  const vendorSitemap = await get("/sitemap.xml", host);
  assert.equal(vendorSitemap.response.status, 200);
  const vendorUrls = [...vendorSitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decode(match[1]));
  assert(vendorUrls.includes(`${origin}/`));
  assert(vendorUrls.includes(`${origin}/products/${store.product_slug}`));
  assert(vendorUrls.every((url) => new URL(url).host === host));
  const vendor = await get("/", host);
  assert.equal(vendor.response.status, 200);
  assert.equal(canonical(vendor.text), `${origin}/`);
  assert(title(vendor.text).includes(store.name));
  assert(schemas(vendor.text).some((schema) => ["LocalBusiness", "Organization"].includes(schema["@type"])));
  const catalogue = await get("/products", host);
  assert.equal(catalogue.response.status, 200);
  assert.equal(canonical(catalogue.text), `${origin}/products`);
  assert(title(catalogue.text).includes("Catalogue"));
  const product = await get(`/products/${store.product_slug}`, host);
  assert.equal(product.response.status, 200);
  assert.equal(canonical(product.text), `${origin}/products/${store.product_slug}`);
  assert(title(product.text).includes(store.product_name));
  assert(schemas(product.text).some((schema) => ["Product", "Service"].includes(schema["@type"])));
  assert(schemas(product.text).some((schema) => schema["@type"] === "BreadcrumbList"));
  const redirect = await get("/browse?category=fashion-clothing", host);
  assert.equal(redirect.response.status, 308);
  assert.equal(redirect.response.headers.get("location"), `${publicOrigin}/browse?category=fashion-clothing`);

  for (const path of ["/login", "/register", "/cart", "/checkout", "/track?reference=test&contact=test", "/pay/callback", "/account", "/vendor", "/admin", "/api/health"]) {
    const page = await get(path);
    assert(page.response.headers.get("x-robots-tag")?.includes("noindex"), path);
  }
  const quote = await get("/quote", host);
  assert.equal(quote.response.status, 200);
  assert(quote.response.headers.get("x-robots-tag")?.includes("noindex"));
  assert(/name="robots" content="noindex/.test(quote.text));
  assert(!quote.text.includes('rel="canonical"'), "transactional forms do not inherit a storefront-home canonical");
  const missing = await get("/s/no-such-seo-fixture", "127.0.0.1:3010");
  assert.equal(missing.response.status, 404);
  const previewRobots = await get("/robots.txt", "project.vercel.app");
  assert(previewRobots.text.includes("Disallow: /"));
  assert(previewRobots.response.headers.get("x-robots-tag")?.includes("noindex"));
  const previewSitemap = await get("/sitemap.xml", "project.vercel.app");
  assert(!previewSitemap.text.includes("<loc>"));
  console.log(`PASS: production HTTP SEO — ${urls.length} platform URLs, ${vendorUrls.length} fixture vendor URLs, metadata/canonicals/JSON-LD, redirects, private/preview noindex and 404s`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
