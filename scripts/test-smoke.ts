/**
 * HTTP smoke test against a running server (dev or production build).
 * Usage: `npm run test:smoke` (defaults to http://127.0.0.1:3000)
 */
const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";

const expectations: Array<{ path: string; status: number[]; name?: string }> = [
  { path: "/", status: [200] },
  { path: "/browse", status: [200] },
  { path: "/stores", status: [200] },
  { path: "/track", status: [200] },
  { path: "/cart", status: [200] },
  { path: "/checkout", status: [307, 302], name: "checkout requires customer sign-in" },
  { path: "/about", status: [200] },
  { path: "/contact", status: [200] },
  { path: "/terms", status: [200] },
  { path: "/privacy", status: [200] },
  { path: "/login", status: [200] },
  { path: "/register", status: [200] },
  { path: "/register/customer", status: [200] },
  { path: "/forgot-password", status: [200] },
  { path: "/auth/google", status: [307, 302], name: "google sign-in redirects (consent or login)" },
  { path: "/s/mamaput-kitchen", status: [200] },
  { path: "/s/mamaput-kitchen/products", status: [200] },
  { path: "/s/uyogadgetmart", status: [200], name: "expired storefront shows the offline screen" },
  { path: "/s/does-not-exist", status: [404], name: "unknown storefront 404s" },
  { path: "/forbidden", status: [200] },
  { path: "/api/health", status: [200] },
  { path: "/api/cron/subscriptions", status: [401], name: "cron requires the secret" },
  { path: "/vendor", status: [307, 302], name: "vendor area redirects anonymous visitors" },
  { path: "/admin", status: [307, 302], name: "admin area redirects anonymous visitors" },
  { path: "/admin/emails", status: [307, 302], name: "email console redirects anonymous visitors" },
  { path: "/admin/announcements", status: [307, 302], name: "announcement console redirects anonymous visitors" },
  { path: "/vendor/announcements", status: [307, 302], name: "vendor announcement composer redirects anonymous visitors" },
  { path: "/account", status: [307, 302], name: "account area redirects anonymous visitors" },
];

async function main() {
  let failures = 0;
  console.log(`Smoke testing ${BASE}\n`);
  for (const item of expectations) {
    try {
      const response = await fetch(`${BASE}${item.path}`, { redirect: "manual" });
      const ok = item.status.includes(response.status);
      if (!ok) failures += 1;
      console.log(`${ok ? "✓" : "✗"} ${item.path} → ${response.status}${item.name ? ` (${item.name})` : ""}`);
    } catch (error) {
      failures += 1;
      console.log(`✗ ${item.path} → ${error instanceof Error ? error.message : "request failed"}`);
    }
  }

  try {
    const webhook = await fetch(`${BASE}/api/webhooks/paystack`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-paystack-signature": "invalid" },
      body: JSON.stringify({ event: "charge.success", data: { reference: "PAY-FAKE" } }),
    });
    const ok = [400, 401, 403, 503].includes(webhook.status);
    if (!ok) failures += 1;
    console.log(`${ok ? "✓" : "✗"} webhook rejects an invalid signature → ${webhook.status}`);
  } catch (error) {
    failures += 1;
    console.log(`✗ webhook check failed: ${error instanceof Error ? error.message : "unknown"}`);
  }

  console.log(`\n${failures === 0 ? "All smoke checks passed." : `${failures} smoke check(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
