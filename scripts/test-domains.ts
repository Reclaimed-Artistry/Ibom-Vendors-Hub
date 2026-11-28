import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { rootDomain, storefrontUrl, subdomainFromHost } from "../src/lib/domains";
import { middleware } from "../src/middleware";

const originalRoot = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
const originalApp = process.env.NEXT_PUBLIC_APP_URL;
try {
  process.env.NEXT_PUBLIC_APP_URL = "https://www.ibomvendorshub.com";
  delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  assert.equal(rootDomain(), "ibomvendorshub.com");
  assert.equal(storefrontUrl("glow-beauty"), "https://glow-beauty.ibomvendorshub.com");
  assert.equal(subdomainFromHost("glow-beauty.ibomvendorshub.com"), "glow-beauty");
  for (const host of ["ibomvendorshub.com", "www.ibomvendorshub.com"]) {
    const response = await middleware(new NextRequest(`https://${host}/s/glow-beauty/book/makeup?date=tomorrow`, { headers: { host } }));
    assert.equal(response.status, 308);
    assert.equal(response.headers.get("location"), "https://glow-beauty.ibomvendorshub.com/book/makeup?date=tomorrow");
  }
  const host = "glow-beauty.ibomvendorshub.com";
  const rewrite = await middleware(new NextRequest(`https://${host}/products`, { headers: { host } }));
  assert(rewrite.headers.get("x-middleware-rewrite")?.endsWith("/s/glow-beauty/products"));
  const avatar = await middleware(new NextRequest(`https://${host}/brand/store-avatar-placeholder.svg`, { headers: { host } }));
  assert.equal(avatar.headers.get("x-middleware-rewrite"), null, "branding assets must load directly on store subdomains");
  for (const preview of ["localhost:3000", "project.vercel.app", "3000-sandbox.e2b.app"]) {
    const result = await middleware(new NextRequest(`http://${preview}/s/glow-beauty`, { headers: { host: preview } }));
    assert.equal(result.headers.get("location"), null);
  }
  const post = await middleware(new NextRequest("https://www.ibomvendorshub.com/s/glow-beauty/book/makeup", { method: "POST", headers: { host: "www.ibomvendorshub.com" } }));
  assert.equal(post.headers.get("location"), null, "do not redirect booking submissions");
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = "https://www.ibomvendorshub.com/";
  assert.equal(storefrontUrl("glow-beauty"), "https://glow-beauty.ibomvendorshub.com");
  console.log("Domain checks passed: store-first URLs, canonical redirects, tenant rewrites, preserved queries, POST and preview safety.");
} finally {
  if (originalRoot === undefined) delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  else process.env.NEXT_PUBLIC_ROOT_DOMAIN = originalRoot;
  if (originalApp === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = originalApp;
}
