import { cache } from "react";
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
  email_from: null,
  resend_api_key: null,
  expiry_reminder_days: [7, 3, 1],
  terms_markdown: null,
  privacy_markdown: null,
  social: {},
  maintenance_mode: false,
};

export const getSettings = cache(async (): Promise<PlatformSettings> => {
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
});

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
