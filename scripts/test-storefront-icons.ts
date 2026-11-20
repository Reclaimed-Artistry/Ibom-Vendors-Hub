import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { middleware } from "../src/middleware";
import { BRAND_ICONS, FAVICON_SIZES, ORGANIZATION_LOGO, PUBLIC_BRAND_ASSET_PATHS } from "../src/lib/brand-assets";

async function assertSquareIcon(input: string | Buffer, size: number) {
  const metadata = await sharp(input).metadata();
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, size);
  assert.equal(metadata.height, size);
  // Catch the previous wide lockup being shrunk to an illegible horizontal
  // sliver in a mostly blank square, not just a technically valid PNG size.
  const { data, info } = await sharp(input).flatten({ background: "#ffffff" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let coloured = 0;
  let top = size;
  let bottom = -1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * info.channels;
      const channels = [data[index], data[index + 1], data[index + 2]];
      if (Math.max(...channels) - Math.min(...channels) > 55 && Math.min(...channels) < 180) {
        coloured++;
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  assert(coloured / (size * size) > 0.2, `${size}px icon has a substantial visible brand mark`);
  assert((bottom - top + 1) / size >= 0.65, `${size}px emblem fills the square vertically, not a letterboxed wordmark`);
}

async function main() {
  process.env.NEXT_PUBLIC_APP_URL = "https://www.ibomvendorshub.com";
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = "ibomvendorshub.com";
  for (const host of [
    "kemcycollections.ibomvendorshub.com", "kissbella-collections.ibomvendorshub.com",
    "www.ibomvendorshub.com", "ibomvendorshub.com", "project.vercel.app",
  ]) {
    for (const path of PUBLIC_BRAND_ASSET_PATHS) {
      for (const query of ["", "?v=legacy", "?q=logo"]) {
        const response = middleware(new NextRequest(`https://${host}${path}${query}`, { headers: { host } }));
        assert.equal(response.headers.get("x-middleware-rewrite"), null, `${host}${path} must not rewrite to a tenant page`);
        assert.equal(response.headers.get("location"), null, `${host}${path} needs no login or redirect`);
        assert.equal(response.headers.get("x-robots-tag"), null, `${host}${path} must not inherit page noindex`);
      }
    }
  }
  // Only exact public assets bypass the usual privacy and preview safeguards.
  const preview = middleware(new NextRequest("https://project.vercel.app/", { headers: { host: "project.vercel.app" } }));
  assert(preview.headers.get("x-robots-tag")?.includes("noindex"));
  const nested = middleware(new NextRequest("https://project.vercel.app/brand/organization-logo.png/private", { headers: { host: "project.vercel.app" } }));
  assert(nested.headers.get("x-robots-tag")?.includes("noindex"));
  const storefront = middleware(new NextRequest("https://kemcycollections.ibomvendorshub.com/products", { headers: { host: "kemcycollections.ibomvendorshub.com" } }));
  assert(new URL(storefront.headers.get("x-middleware-rewrite")!).pathname.includes("/s/kemcycollections/products"), "normal storefront rewrite retained");

  for (const icon of BRAND_ICONS.icon) {
    const [width, height] = icon.sizes.split("x").map(Number);
    assert(width > 48 && width === height, "advertised search icons are square and larger than Google's recommended 48px");
    assert(!icon.url.includes("?"), "use stable public favicon URLs, not rotating query strings");
    await assertSquareIcon(`public${icon.url}`, width);
  }
  for (const size of [32, 48]) await assertSquareIcon(`public/brand/favicon-${size}.png`, size);
  await assertSquareIcon("src/app/icon.png", 256);
  await assertSquareIcon("src/app/apple-icon.png", 180);

  const ico = readFileSync("public/favicon.ico");
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), FAVICON_SIZES.length);
  let expectedOffset = 6 + FAVICON_SIZES.length * 16;
  for (const [index, size] of FAVICON_SIZES.entries()) {
    const entry = 6 + index * 16;
    assert.equal(ico[entry] || 256, size);
    assert.equal(ico[entry + 1] || 256, size);
    assert.equal(ico.readUInt16LE(entry + 4), 1);
    assert.equal(ico.readUInt16LE(entry + 6), 32);
    const length = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    assert.equal(offset, expectedOffset);
    assert(length > 0 && offset + length <= ico.length);
    await assertSquareIcon(ico.subarray(offset, offset + length), size);
    expectedOffset += length;
  }
  assert.equal(expectedOffset, ico.length, "every ICO image is valid, with no trailing or missing bytes");

  const logo = await sharp(`public${ORGANIZATION_LOGO.path}`).metadata();
  assert.equal(logo.format, "png");
  assert.equal(logo.width, ORGANIZATION_LOGO.width);
  assert.equal(logo.height, ORGANIZATION_LOGO.height);
  assert(logo.width! >= 112 && logo.height! >= 112, "Organization logo meets Google's minimum dimensions");
  assert.equal(logo.hasAlpha, false, "full logo is readable on an opaque white background");
  console.log("PASS: legible square brand icons, multi-size ICO, full Organization logo, stable metadata and crawlable platform/vendor asset routing");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
