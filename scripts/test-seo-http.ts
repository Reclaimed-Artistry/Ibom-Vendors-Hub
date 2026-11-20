import assert from "node:assert/strict";
import { request } from "node:http";
import { JSDOM } from "jsdom";
import { systemDb } from "../src/lib/db";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { BRAND_ICONS, ORGANIZATION_LOGO, PUBLIC_BRAND_ASSET_PATHS } from "../src/lib/brand-assets";

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
function assertStorefrontFooter(html: string, storeName: string) {
  const dom = new JSDOM(html);
  try {
    const footer = dom.window.document.querySelector("footer");
    const brand = footer?.querySelector("span.inline-block.whitespace-nowrap");
    assert.equal(brand?.textContent, "Ibom Vendors Hub", "the full platform name stays together on mobile");
    const copy = brand?.parentElement;
    assert.equal(copy?.textContent?.replace(/\s+/g, " ").trim(), `${storeName} is a verified vendor on Ibom Vendors Hub`);
    assert(copy?.classList.contains("min-w-0"), "long vendor names can shrink and wrap instead of overflowing");
    assert(!copy.classList.contains("whitespace-nowrap"), "do not force the whole sentence onto one overflowing line");
    assert(footer?.querySelector('svg.shrink-0[aria-hidden="true"]'), "the decorative verification icon retains its size");
    assert(footer?.querySelector('a[aria-label="Ibom Vendors Hub — home"]'), "powered-by logo and marketplace link are preserved");
  } finally {
    dom.window.close();
  }
}
function getResource(path: string, host = ROOT, userAgent = "Googlebot", method = "GET"): Promise<{ response: { status: number; headers: Headers }; body: Buffer }> {
  // Node fetch can silently replace Host. A raw local HTTP request is needed
  // to exercise the real wildcard middleware without external wildcard DNS.
  return new Promise((resolve, reject) => {
    const req = request(new URL(path, BASE), { method, headers: { host, "user-agent": userAgent } }, (res) => {
      const headers = new Headers();
      for (const [key, value] of Object.entries(res.headers)) {
        if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
      }
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => { chunks.push(chunk); });
      res.on("end", () => resolve({ response: { status: res.statusCode ?? 0, headers }, body: Buffer.concat(chunks) }));
      res.on("error", reject);
    });
    req.setTimeout(30000, () => req.destroy(new Error(`Timed out: ${path}`)));
    req.on("error", reject);
    req.end();
  });
}
async function get(path: string, host = ROOT) {
  const { response, body } = await getResource(path, host);
  return { response, text: body.toString("utf8") };
}

async function main() {
  // Keep the owner's uploaded verification file accessible without sign-in.
  // Google may recheck it later, so this is a permanent public asset.
  const verification = await get("/google5165a16b9a302297.html");
  assert.equal(verification.response.status, 200);
  assert(verification.response.headers.get("content-type")?.includes("text/html"));
  assert.equal(verification.response.headers.get("location"), null);
  assert.equal(verification.text, "google-site-verification: google5165a16b9a302297.html");
  console.log("PASS: permanent Google HTML verification file returns the exact uploaded content without authentication or redirects");

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
  const head = new JSDOM(home.text);
  try {
    for (const icon of BRAND_ICONS.icon) {
      const link = head.window.document.head.querySelector(`link[rel="icon"][sizes="${icon.sizes}"]`);
      assert.equal(link?.getAttribute("href"), icon.url, "search icon is present in server-rendered homepage head");
      assert.equal(link?.getAttribute("type"), "image/png");
    }
    assert.equal(head.window.document.head.querySelector('link[rel="shortcut icon"]')?.getAttribute("href"), "/favicon.ico");
    assert(!home.text.includes("?v=ivh-1"), "old query-versioned full-lockup icons are not advertised");
  } finally { head.window.close(); }
  const organization = schemas(home.text).flatMap((schema) => schema["@graph"] ?? []).find((node: any) => node["@type"] === "Organization");
  assert.equal(organization.logo.url, `${publicOrigin}${ORGANIZATION_LOGO.path}`);
  assert.equal(organization.logo.contentUrl, organization.logo.url);
  assert.equal(organization.logo.width, ORGANIZATION_LOGO.width);
  assert.equal(organization.logo.height, ORGANIZATION_LOGO.height);

  // Test real response bytes, MIME types and noindex/auth/routing behavior,
  // including paths fetched by Googlebot-Image instead of a page crawler.
  for (const host of [ROOT, "kemcycollections.ibomvendorshub.com", "project.vercel.app"]) {
    for (const path of PUBLIC_BRAND_ASSET_PATHS) {
      const asset = await getResource(path, host, "Googlebot-Image/1.0");
      assert.equal(asset.response.status, 200, `${host}${path}`);
      assert(asset.response.headers.get("content-type")?.startsWith("image/"), `${path} has an image MIME type`);
      assert.equal(asset.response.headers.get("location"), null, `${path} requires no authentication or redirect`);
      assert.equal(asset.response.headers.get("x-robots-tag"), null, `${path} is not noindexed`);
      const file = path === "/icon.png" || path === "/apple-icon.png" ? `src/app${path}` : `public${path}`;
      assert.deepEqual(asset.body, readFileSync(file), `${path} serves the intended artwork unchanged`);
      if (path.endsWith(".png")) {
        const image = await sharp(asset.body).metadata();
        assert.equal(image.format, "png");
        if (path === ORGANIZATION_LOGO.path) {
          assert.equal(image.width, ORGANIZATION_LOGO.width);
          assert.equal(image.height, ORGANIZATION_LOGO.height);
        } else {
          assert.equal(image.width, image.height, `${path} is square`);
        }
      }
    }
    const iconHead = await getResource("/brand/favicon-96.png", host, "Googlebot-Image/1.0", "HEAD");
    assert.equal(iconHead.response.status, 200);
    assert.equal(iconHead.body.length, 0);
    assert.equal(iconHead.response.headers.get("x-robots-tag"), null);
  }
  console.log("PASS: server-rendered stable favicon links and full Organization logo; public image bytes/MIME/GET/HEAD on platform, vendor and preview hosts");

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
  assertStorefrontFooter(vendor.text, store.name);
  assert.equal(canonical(vendor.text), `${origin}/`);
  assert(title(vendor.text).includes(store.name));
  assert(schemas(vendor.text).some((schema) => ["LocalBusiness", "Organization"].includes(schema["@type"])));
  const catalogue = await get("/products", host);
  assert.equal(catalogue.response.status, 200);
  assertStorefrontFooter(catalogue.text, store.name);
  assert.equal(canonical(catalogue.text), `${origin}/products`);
  assert(title(catalogue.text).includes("Catalogue"));
  const product = await get(`/products/${store.product_slug}`, host);
  assert.equal(product.response.status, 200);
  assertStorefrontFooter(product.text, store.name);
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
  assertStorefrontFooter(quote.text, store.name);
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
  console.log("PASS: shared mobile-safe vendor footer on storefront home, catalogue, product and quotation pages");
  console.log(`PASS: production HTTP SEO — ${urls.length} platform URLs, ${vendorUrls.length} fixture vendor URLs, metadata/canonicals/JSON-LD, redirects, private/preview noindex and 404s`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
