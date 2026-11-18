import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "../src/middleware";
import { readFileSync } from "node:fs";
import sharp from "sharp";

async function main() {
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = "ibomvendorshub.com";
  for (const host of ["kemcycollections.ibomvendorshub.com", "kissbella-collections.ibomvendorshub.com", "www.ibomvendorshub.com"]) {
    for (const path of ["/icon.png?v=test", "/apple-icon.png", "/brand/favicon-32.png?v=ivh-1", "/brand/icon-512.png"]) {
      const response = middleware(new NextRequest(`https://${host}${path}`, {headers:{host}}));
      assert.equal(response.headers.get("x-middleware-rewrite"), null, `${host}${path} must not rewrite to a tenant page`);
      assert.equal(response.headers.get("location"), null);
    }
  }
  const storefront = middleware(new NextRequest("https://kemcycollections.ibomvendorshub.com/products",{headers:{host:"kemcycollections.ibomvendorshub.com"}}));
  assert(new URL(storefront.headers.get("x-middleware-rewrite")!).pathname.includes("/s/kemcycollections/products"),"normal storefront rewrite retained");
  const png = await sharp("public/brand/favicon-32.png").metadata();
  assert.equal(png.width,32); assert.equal(png.height,32);
  const ico = readFileSync("public/favicon.ico");
  assert.equal(ico.readUInt16LE(2),1); assert.equal(ico.readUInt16LE(4),1);
  assert.equal(ico.readUInt32LE(14),ico.length-22);
  console.log("Storefront icon checks passed: platform and tenant asset routing, valid favicon files, normal storefront routing retained.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
