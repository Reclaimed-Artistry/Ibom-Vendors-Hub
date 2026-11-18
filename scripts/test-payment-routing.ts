import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "../src/middleware";
process.env.NEXT_PUBLIC_ROOT_DOMAIN = "ibomvendorshub.com";
for (const path of ["/checkout", "/cart", "/pay/PAY-test", "/pay/callback?reference=PAY-test", "/account/orders", "/login"]) {
  const request = new NextRequest(`https://kemcycollections.ibomvendorshub.com${path}`, { headers: {host:"kemcycollections.ibomvendorshub.com"} });
  const result = middleware(request);
  assert(!result.headers.has("x-middleware-rewrite"), `${path} must not become a tenant page`);
  if (path === "/checkout") assert(result.headers.get("location")?.includes("/login?next="));
}
const store = middleware(new NextRequest("https://kemcycollections.ibomvendorshub.com/products", {headers:{host:"kemcycollections.ibomvendorshub.com"}}));
assert(store.headers.get("x-middleware-rewrite")?.includes("/s/kemcycollections/products"));
console.log("Payment routing passed: tenant checkout, cart, portal, callback, login and account remain platform routes; product routing preserved.");
