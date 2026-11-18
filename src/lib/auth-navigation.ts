import { appUrl, rootDomain, subdomainFromHost, isReservedSubdomain } from "@/lib/domains";

export function safeAuthNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\r\n]/.test(next)) return null;
  return next;
}

/** Auth must survive the approved Google callback's apex/tenant boundary. */
export function authCookieDomain(host: string | null): string | undefined {
  const root = rootDomain().split(":")[0];
  const hostname = (host ?? "").split(":")[0].toLowerCase();
  if (root === "localhost" || /^[\d.]+$/.test(root)) return undefined;
  return hostname === root || hostname.endsWith(`.${root}`) ? `.${root}` : undefined;
}

export function googleNextForHost(host: string | null, next: string | null): string | null {
  const destination = safeAuthNext(next);
  const tenant = subdomainFromHost(host);
  if (!tenant || isReservedSubdomain(tenant)) return destination;
  return `/auth/continue?store=${encodeURIComponent(tenant)}&next=${encodeURIComponent(destination ?? "/account")}`;
}

export function authContinueUrl(store: string | null, next: string | null): string {
  const path = safeAuthNext(next) ?? "/account";
  if (!store || !/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(store) || isReservedSubdomain(store)) return `${appUrl()}${path}`;
  return `${new URL(appUrl()).protocol}//${store}.${rootDomain()}${path}`;
}
