/**
 * Subdomain helpers. Shared by edge middleware (no DB access) and server code.
 */

export const RESERVED_SUBDOMAINS = new Set([
  "www", "admin", "administrator", "dashboard", "api", "app", "support", "mail", "email",
  "help", "blog", "docs", "status", "store", "stores", "vendor", "vendors", "account",
  "accounts", "auth", "login", "signup", "signin", "register", "payments", "pay", "checkout",
  "static", "assets", "cdn", "images", "media", "root", "system", "superadmin", "marketplace",
  "track", "tracking", "terms", "privacy", "about", "contact", "faq", "sitemap", "robots",
  "webhooks", "cron", "health", "ibom", "ibomvendorshub", "test", "demo", "staging", "dev",
  "preview",
]);

export function isReservedSubdomain(name: string) {
  return RESERVED_SUBDOMAINS.has(name.toLowerCase());
}

export function normaliseSubdomain(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Root domain without protocol, e.g. "ibomvendorshub.com" or "localhost:3000". */
export function rootDomain() {
  const configured = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  const source = configured || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const parsed = new URL(source.includes("://") ? source : `https://${source}`);
  // Tenant names must precede the apex domain, never storename.www.domain.com.
  return parsed.host.toLowerCase().replace(/^www\./, "");
}

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function protocol() {
  return appUrl().startsWith("https://") ? "https" : "http";
}

export function storefrontUrl(slug: string) {
  return `${protocol()}://${slug}.${rootDomain()}`;
}

/** Local/preview-safe storefront link (works without wildcard DNS). */
export function storefrontPath(slug: string) {
  return `/s/${slug}`;
}

/**
 * Resolve the vendor subdomain from a Host header.
 * Returns null when the request is for the platform root (marketplace, admin…).
 */
export function subdomainFromHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const clean = host.split(":")[0].toLowerCase();
  const root = rootDomain().split(":")[0];
  if (clean === root || clean === `www.${root}`) return null;
  if (clean.endsWith(`.${root}`)) {
    const sub = clean.slice(0, -(root.length + 1));
    if (!sub || sub.includes(".")) return null;
    return sub;
  }
  // Vercel preview / custom hosts: {port}-{sandbox}.e2b.app etc. No tenant.
  return null;
}
