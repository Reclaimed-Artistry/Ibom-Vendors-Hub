import { cache } from "react";
import { unstable_cache } from "next/cache";
import { systemDb } from "@/lib/db";
import type { PlatformSettings } from "@/lib/types";
import { appUrl, rootDomain } from "@/lib/domains";

const DEFAULTS: PlatformSettings = {
  id: 1,
  platform_name: "Ibom Vendors Hub",
  tagline: "Every business. One address.",
  logo_url: null,
  main_domain: "localhost:3000",
  support_email: "support@ibomvendorshub.com",
  support_phone: "+234 800 000 0000",
  currency: "NGN",
  currency_symbol: "₦",
  country: "Nigeria",
  default_trial_days: 14,
  grace_period_days: 0,
  commission_rate: 5,
  require_vendor_approval: false,
  payments_enabled: true,
  sandbox_payments: true,
  paystack_public_key: null,
  paystack_secret_key: null,
  google_client_id: null,
  google_client_secret: null,
  google_signin_enabled: true,
  email_from: null,
  resend_api_key: null,
  expiry_reminder_days: [7, 3, 1],
  terms_markdown: null,
  privacy_markdown: null,
  social: {},
  maintenance_mode: false,
};

async function loadSettings(): Promise<PlatformSettings> {
  try {
    const row = await systemDb.maybeOne<PlatformSettings>(
      `select * from platform_settings where id = 1`,
    );
    if (!row) return DEFAULTS;
    return {
      ...DEFAULTS,
      ...row,
      commission_rate: Number(row.commission_rate),
      expiry_reminder_days: row.expiry_reminder_days?.length ? row.expiry_reminder_days : [7, 3, 1],
      social: row.social ?? {},
    };
  } catch {
    return DEFAULTS;
  }
}

/**
 * Settings power the header, footer and money formatting on every page, so the
 * row is cached across requests instead of costing a database round trip per
 * render. `cache()` still de-duplicates within a request; settings writes call
 * revalidateTag("settings") so a save is visible on the next paint.
 */
const cachedSettings = unstable_cache(loadSettings, ["platform-settings"], {
  tags: ["settings"],
  revalidate: 300,
});

export const getSettings = cache(cachedSettings);

/**
 * Compact form of the platform name for tight spots like the header CTA:
 * "Ibom Vendors Hub" → "Ibom VH" (first word kept, the rest as initials).
 */
export function shortPlatformName(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return words[0] ?? "";
  return [words[0], words.slice(1).map((word) => word[0]?.toUpperCase() ?? "").join("")].join(" ");
}

export function paystackSecret(settings: PlatformSettings) {
  return settings.paystack_secret_key || process.env.PAYSTACK_SECRET_KEY || "";
}

export function paystackPublic(settings: PlatformSettings) {
  return (
    settings.paystack_public_key ||
    process.env.PAYSTACK_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ||
    ""
  );
}

export function resendKey(settings: PlatformSettings) {
  return settings.resend_api_key || process.env.RESEND_API_KEY || "";
}

export function emailFrom(settings: PlatformSettings) {
  return settings.email_from || process.env.EMAIL_FROM || "Ibom Vendors Hub <noreply@ibomvendorshub.com>";
}

export function paymentMode(settings: PlatformSettings): "paystack" | "sandbox" {
  return paystackSecret(settings) ? "paystack" : "sandbox";
}

export type KeyKind = "missing" | "test" | "live" | "unknown";
export type KeySource = "platform settings" | "environment" | "missing";

export interface GatewayStatus {
  mode: "paystack" | "sandbox";
  secretConfigured: boolean;
  publicConfigured: boolean;
  secretKind: KeyKind;
  publicKind: KeyKind;
  secretSource: KeySource;
  publicSource: KeySource;
  publicHint: string;
  warnings: string[];
}

function keyKind(value: string): KeyKind {
  if (!value) return "missing";
  if (value.startsWith("sk_test_") || value.startsWith("pk_test_")) return "test";
  if (value.startsWith("sk_live_") || value.startsWith("pk_live_")) return "live";
  return "unknown";
}

function mask(value: string) {
  if (!value) return "";
  return value.length <= 16 ? `${value.slice(0, 6)}…` : `${value.slice(0, 12)}…${value.slice(-4)}`;
}

/**
 * What the payment stack can and cannot do right now.
 *
 * Paystack needs the *secret* key to initialise and verify a transaction; a
 * public key on its own cannot charge anybody (this app redirects to Paystack's
 * hosted checkout rather than using the inline popup). Surfacing that mismatch
 * is more useful than silently staying in sandbox mode.
 */
export function gatewayStatus(settings: PlatformSettings): GatewayStatus {
  const secret = paystackSecret(settings);
  const pub = paystackPublic(settings);
  const secretKind = keyKind(secret);
  const publicKind = keyKind(pub);
  const warnings: string[] = [];

  if (!secret) {
    warnings.push(
      pub
        ? "A public key alone cannot take payments — add the matching Paystack secret key (sk_test_… / sk_live_…) and checkout leaves sandbox mode."
        : "No Paystack keys are configured, so checkout runs on the built-in sandbox gateway and no money moves.",
    );
  }
  if (secret && !pub) {
    warnings.push("Only the secret key is set. Transactions still work, but add the public key so both halves of the Paystack integration are visible to future admin changes.");
  }
  if (secretKind !== "missing" && publicKind !== "missing" && secretKind !== publicKind) {
    warnings.push(`The secret key looks ${secretKind} while the public key looks ${publicKind} — mixing test and live keys makes Paystack reject every transaction.`);
  }
  if (secret && settings.sandbox_payments) {
    warnings.push("Keys are configured but the sandbox switch is still on in Platform settings, so customers keep seeing the sandbox screen.");
  }

  return {
    mode: paymentMode(settings),
    secretConfigured: Boolean(secret),
    publicConfigured: Boolean(pub),
    secretKind,
    publicKind,
    secretSource: settings.paystack_secret_key ? "platform settings" : secret ? "environment" : "missing",
    publicSource: settings.paystack_public_key ? "platform settings" : pub ? "environment" : "missing",
    publicHint: mask(pub),
    warnings,
  };
}

/** Absolute URL helpers used in emails and redirects. */
export function url(path: string) {
  return `${appUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function storefrontUrlFor(slug: string) {
  return `${appUrl().startsWith("https") ? "https" : "http"}://${slug}.${rootDomain()}`;
}

export function currencySymbol(settings: PlatformSettings) {
  return settings.currency_symbol || "₦";
}
