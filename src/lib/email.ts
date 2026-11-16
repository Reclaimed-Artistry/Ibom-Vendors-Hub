import { createHmac, timingSafeEqual } from "node:crypto";
import { systemDb } from "@/lib/db";
import { emailFrom, getSettings, resendKey, url } from "@/lib/settings";
import { formatMoney } from "@/lib/utils";

/**
 * Transactional email.
 *
 * All messages are rendered through reusable HTML templates, persisted to
 * `email_logs` (with dedupe keys so an event can never be emailed twice) and
 * delivered through Resend when a key is configured. Without a provider the
 * message is still rendered and stored, which keeps every flow testable and
 * visible to administrators under Admin → Emails.
 */

export interface EmailData {
  name?: string;
  email?: string;
  storeName?: string;
  storeUrl?: string;
  orderReference?: string;
  checkoutReference?: string;
  amount?: number | string;
  currency?: string;
  items?: Array<{ name: string; quantity: number; line_total?: number | string; unit_price?: number | string }>;
  status?: string;
  reason?: string;
  note?: string;
  link?: string;
  code?: string;
  planName?: string;
  expiresAt?: string;
  daysRemaining?: number | string;
  eta?: string;
  scheduledFor?: string;
  quoteAmount?: number | string;
  message?: string;
  subject?: string;
  [key: string]: unknown;
}

interface RenderedEmail {
  subject: string;
  heading: string;
  intro: string;
  rows?: Array<[string, string]>;
  cta?: { label: string; href: string };
  footnote?: string;
}

const BRAND = {
  name: "Ibom Vendors Hub",
  teal: "#0f766e",
  gold: "#d97706",
  ink: "#0f172a",
  muted: "#64748b",
  surface: "#f8fafc",
};

function money(amount: unknown, currency = "NGN") {
  return formatMoney(Number(amount ?? 0), currency);
}

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function itemsTable(items: NonNullable<EmailData["items"]>, currency = "NGN") {
  const rows = items
    .map(
      (item) => `<tr>
        <td style="padding:8px 0;color:${BRAND.ink}">${esc(item.name)} <span style="color:${BRAND.muted}">× ${item.quantity}</span></td>
        <td style="padding:8px 0;text-align:right;color:${BRAND.ink}">${money(
          item.line_total ?? Number(item.unit_price ?? 0) * item.quantity,
          currency,
        )}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;margin-top:12px">${rows}</table>`;
}

function template(name: string, data: EmailData): RenderedEmail {
  const site = url("/");
  const trackLink = data.orderReference
    ? url(`/track?reference=${encodeURIComponent(data.orderReference)}`)
    : site;

  switch (name) {
    case "verify_email":
      return {
        subject: "Verify your Ibom Vendors Hub email address",
        heading: "Confirm your email address",
        intro: `Hi ${data.name ?? "there"}, welcome to Ibom Vendors Hub. Confirm your email address to secure your account and receive order updates.`,
        cta: { label: "Verify my email", href: data.link ?? site },
        footnote: "This link expires in 24 hours. If you did not create an account you can safely ignore this email.",
      };
    case "reset_password":
      return {
        subject: "Reset your Ibom Vendors Hub password",
        heading: "Reset your password",
        intro: `Hi ${data.name ?? "there"}, we received a request to reset your password. Choose a new password using the button below.`,
        cta: { label: "Choose a new password", href: data.link ?? site },
        footnote: "The link expires in 60 minutes. You can ignore this email if you did not request a reset.",
      };
    case "account_security":
      return {
        subject: "Your account security was updated",
        heading: "Account security updated",
        intro: data.message ?? "Your password was changed successfully.",
        footnote: "If this wasn't you, reset your password immediately and contact support.",
      };
    case "vendor_welcome":
      return {
        subject: `Your storefront is live — ${data.storeName ?? ""}`.trim(),
        heading: "Your storefront is ready 🎉",
        intro: `Hi ${data.name ?? "there"}, ${data.storeName ?? "your store"} is now on Ibom Vendors Hub. Start adding products and share your store link with customers.`,
        rows: [
          ["Store URL", data.storeUrl ?? ""],
          ["Plan", data.planName ?? "Starter trial"],
          ["Subscription ends", data.expiresAt ?? ""],
        ],
        cta: { label: "Open my dashboard", href: url("/vendor") },
      };
    case "customer_welcome":
      return {
        subject: "Welcome to Ibom Vendors Hub",
        heading: "Welcome aboard",
        intro: `Hi ${data.name ?? "there"}, your customer account is ready. Discover authentic vendors across Akwa Ibom and track every order in one place.`,
        cta: { label: "Start exploring", href: site },
      };
    case "order_receipt":
      return {
        subject: `Order ${data.orderReference} received`,
        heading: "We received your order",
        intro: `Thanks ${data.name ?? ""}! Your order from ${data.storeName ?? "the vendor"} has been received and is awaiting payment confirmation.`,
        rows: [
          ["Order reference", data.orderReference ?? ""],
          ["Store", data.storeName ?? ""],
          ["Total", money(data.amount, data.currency)],
        ],
        cta: { label: "Track my order", href: trackLink },
      };
    case "order_vendor_new":
      return {
        subject: `New order ${data.orderReference} — ${money(data.amount, data.currency)}`,
        heading: "You have a new order",
        intro: `A new order just came in${data.storeName ? ` for ${data.storeName}` : ""}. Review it and accept it from your dashboard.`,
        rows: [
          ["Order reference", data.orderReference ?? ""],
          ["Customer", data.name ?? ""],
          ["Total", money(data.amount, data.currency)],
        ],
        cta: { label: "Open order", href: url("/vendor/orders") },
      };
    case "payment_confirmed":
      return {
        subject: `Payment confirmed for ${data.orderReference ?? "your order"}`,
        heading: "Payment confirmed",
        intro: `We have verified your payment of ${money(data.amount, data.currency)}. The vendor has been notified and will process your order shortly.`,
        rows: [["Order", data.orderReference ?? ""]],
        cta: { label: "View order", href: trackLink },
      };
    case "order_accepted":
      return {
        subject: `Order ${data.orderReference} accepted`,
        heading: "Your order was accepted",
        intro: `${data.storeName ?? "The vendor"} has accepted your order and will keep you updated at every stage.`,
        rows: [["Estimated completion", data.eta ?? "To be confirmed"]],
        cta: { label: "Track order", href: trackLink },
      };
    case "order_rejected":
      return {
        subject: `Order ${data.orderReference} could not be accepted`,
        heading: "Order could not be accepted",
        intro: `${data.storeName ?? "The vendor"} was unable to accept your order. ${data.reason ? `Reason: ${data.reason}.` : ""}`,
        cta: { label: "View order", href: trackLink },
        footnote: "If you paid for this order, a refund will be processed.",
      };
    case "order_preparing":
      return {
        subject: `Order ${data.orderReference} is being prepared`,
        heading: "Your order is being prepared",
        intro: `${data.storeName ?? "The vendor"} has started preparing your order.`,
        rows: [["Estimated ready time", data.eta ?? "As soon as possible"]],
        cta: { label: "Track order", href: trackLink },
      };
    case "production_started":
      return {
        subject: `Production started for ${data.orderReference}`,
        heading: "Production has started",
        intro: `Great news — ${data.storeName ?? "the maker"} has started production on your order.`,
        rows: [
          ["Estimated completion", data.eta ?? "To be confirmed"],
          ["Progress", data.status ?? "In production"],
        ],
        cta: { label: "See production progress", href: trackLink },
      };
    case "production_completed":
      return {
        subject: `Production completed for ${data.orderReference}`,
        heading: "Production completed",
        intro: `Your order has finished production and is being prepared for dispatch.`,
        rows: [["Estimated dispatch", data.eta ?? "Soon"]],
        cta: { label: "Track order", href: trackLink },
      };
    case "ready_for_pickup":
      return {
        subject: `Order ${data.orderReference} is ready`,
        heading: "Ready for pickup",
        intro: `Your order is ready. ${data.note ?? "Please come to the store to collect it."}`,
        cta: { label: "Order details", href: trackLink },
      };
    case "order_dispatched":
      return {
        subject: `Order ${data.orderReference} is on the way`,
        heading: "Your order has been dispatched",
        intro: `Your order is on its way. ${data.note ?? ""}`,
        rows: [
          ["Estimated arrival", data.eta ?? "Soon"],
          ["Tracking", data.code ?? "Provided by vendor"],
        ],
        cta: { label: "Track delivery", href: trackLink },
      };
    case "order_delivered":
      return {
        subject: `Order ${data.orderReference} delivered`,
        heading: "Delivered — enjoy!",
        intro: `Your order from ${data.storeName ?? "the vendor"} has been delivered. Thank you for shopping on Ibom Vendors Hub.`,
        cta: { label: "Leave a review", href: trackLink },
      };
    case "order_cancelled":
      return {
        subject: `Order ${data.orderReference} cancelled`,
        heading: "Order cancelled",
        intro: `Your order has been cancelled. ${data.reason ? `Reason: ${data.reason}.` : ""}`,
        cta: { label: "View details", href: trackLink },
        footnote: "Any verified payment will be refunded according to our refund policy.",
      };
    case "eta_updated":
      return {
        subject: `Updated timeline for ${data.orderReference}`,
        heading: "Estimated delivery updated",
        intro: `${data.storeName ?? "The vendor"} updated the timeline for your order. These dates are estimates, not guarantees.`,
        rows: [
          ["New estimated date", data.eta ?? ""],
          ["Note", data.note ?? "—"],
        ],
        cta: { label: "View order timeline", href: trackLink },
      };
    case "refund_updated":
      return {
        subject: `Refund ${data.status ?? "update"} for ${data.orderReference ?? "your order"}`,
        heading: "Refund update",
        intro: `Your refund of ${money(data.amount, data.currency)} is now ${data.status ?? "processing"}.`,
        footnote: "Bank settlement usually completes within 3–10 business days.",
      };
    case "booking_confirmed":
      return {
        subject: `Booking confirmed for ${data.scheduledFor ?? "your appointment"}`,
        heading: "Your booking is confirmed",
        intro: `${data.storeName ?? "The vendor"} confirmed your appointment.`,
        rows: [
          ["When", data.scheduledFor ?? ""],
          ["Reference", data.orderReference ?? ""],
        ],
        cta: { label: "View booking", href: trackLink },
      };
    case "quote_requested":
      return {
        subject: `New quotation request${data.storeName ? ` for ${data.storeName}` : ""}`,
        heading: "New quotation request",
        intro: `A customer has requested a quotation. ${data.message ? `They said: “${data.message}”` : ""}`,
        cta: { label: "Respond with a quote", href: url("/vendor/quotations") },
      };
    case "quote_sent":
      return {
        subject: `Your quotation is ready — ${money(data.quoteAmount, data.currency)}`,
        heading: "Your quotation is ready",
        intro: `${data.storeName ?? "The vendor"} has prepared a quotation for your request. Accept it to continue to payment.`,
        rows: [
          ["Amount", money(data.quoteAmount, data.currency)],
          ["Valid until", data.expiresAt ?? "—"],
          ["Note", data.note ?? "—"],
        ],
        cta: { label: "Review quotation", href: url("/account/quotations") },
      };
    case "quote_accepted":
      return {
        subject: "Your quotation was accepted",
        heading: "Quotation accepted",
        intro: `Good news — your quotation of ${money(data.quoteAmount, data.currency)} was accepted. Start work when payment is confirmed.`,
        cta: { label: "Open order", href: url("/vendor/orders") },
      };
    case "quote_rejected":
      return {
        subject: "Your quotation was declined",
        heading: "Quotation declined",
        intro: `A customer declined your quotation of ${money(data.quoteAmount, data.currency)}. ${data.note ? `They said: “${data.note}”` : ""}`,
      };
    case "subscription_activated":
    case "subscription_renewed":
      return {
        subject:
          name === "subscription_renewed"
            ? "Your subscription has been renewed"
            : "Your subscription is active",
        heading: name === "subscription_renewed" ? "Subscription renewed" : "Subscription activated",
        intro: `Your ${data.planName ?? ""} plan is active. Your storefront is online and accepting orders.`,
        rows: [
          ["Plan", data.planName ?? ""],
          ["Amount", money(data.amount, data.currency)],
          ["Valid until", data.expiresAt ?? ""],
        ],
        cta: { label: "Manage subscription", href: url("/vendor/subscription") },
      };
    case "subscription_expiring":
      return {
        subject: `Your store subscription expires in ${data.daysRemaining ?? "a few"} days`,
        heading: "Your subscription is expiring",
        intro: `Your ${data.planName ?? ""} subscription expires on ${data.expiresAt ?? "soon"}. Renew now to keep your storefront online and avoid losing sales.`,
        rows: [
          ["Days remaining", String(data.daysRemaining ?? "")],
          ["Expiry date", data.expiresAt ?? ""],
        ],
        cta: { label: "Renew subscription", href: url("/vendor/subscription") },
      };
    case "subscription_expired":
      return {
        subject: "Your storefront is offline — subscription expired",
        heading: "Your subscription has expired",
        intro: `Your subscription expired on ${data.expiresAt ?? "today"} and your storefront is no longer publicly visible. Your data is safe — renew to reactivate instantly.`,
        cta: { label: "Renew now", href: url("/vendor/subscription") },
      };
    case "store_suspended":
      return {
        subject: "Your storefront has been suspended",
        heading: "Storefront suspended",
        intro: `An administrator suspended your storefront. ${data.reason ? `Reason: ${data.reason}.` : ""}`,
        footnote: "Contact support if you believe this was a mistake. Nothing has been deleted.",
      };
    case "store_reactivated":
      return {
        subject: "Your storefront is live again",
        heading: "Storefront reactivated",
        intro: `Your storefront is publicly available again and customers can place orders.`,
        cta: { label: "View storefront", href: data.storeUrl ?? site },
      };
    case "admin_new_vendor":
      return {
        subject: `New vendor registered: ${data.storeName ?? ""}`,
        heading: "New vendor registration",
        intro: `${data.storeName ?? "A new vendor"} just registered on the platform.`,
        rows: [
          ["Owner", data.name ?? ""],
          ["Email", data.email ?? ""],
        ],
        cta: { label: "Review vendor", href: url("/admin/vendors") },
      };
    case "admin_subscription_payment":
      return {
        subject: `Subscription payment: ${money(data.amount, data.currency)}`,
        heading: "Subscription payment received",
        intro: `${data.storeName ?? "A vendor"} paid for the ${data.planName ?? ""} plan.`,
        rows: [["Amount", money(data.amount, data.currency)]],
        cta: { label: "View payments", href: url("/admin/payments") },
      };
    case "admin_failed_payment":
      return {
        subject: "Failed payment attempt",
        heading: "Payment failure",
        intro: `A payment attempt failed for ${data.storeName ?? data.email ?? "a customer"}.`,
        rows: [
          ["Reference", data.orderReference ?? ""],
          ["Reason", data.reason ?? "Declined by gateway"],
        ],
      };
    case "admin_manual_suspension":
      return {
        subject: `Store suspended: ${data.storeName ?? ""}`,
        heading: "Store suspended",
        intro: `${data.storeName ?? "A store"} was suspended. Reason: ${data.reason ?? "Not provided"}.`,
      };
    case "message_received":
      return {
        subject: data.subject ?? "New customer message",
        heading: "New message",
        intro: `${data.name ?? "Someone"} sent a message${data.storeName ? ` to ${data.storeName}` : ""}.`,
        rows: [
          ["From", data.email ?? ""],
          ["Message", data.message ?? ""],
        ],
        cta: { label: "Reply", href: data.link ?? url("/vendor/messages") },
      };
    case "review_received":
      return {
        subject: "You received a new review",
        heading: "New customer review",
        intro: `${data.name ?? "A customer"} left a review for ${data.storeName ?? "your store"}.`,
        rows: [
          ["Rating", `${data.amount ?? ""} / 5`],
          ["Review", data.message ?? ""],
        ],
        cta: { label: "Respond to review", href: url("/vendor/reviews") },
      };
    default:
      return {
        subject: data.subject ?? "Ibom Vendors Hub",
        heading: data.subject ?? "Ibom Vendors Hub",
        intro: data.message ?? "You have a new notification from Ibom Vendors Hub.",
        cta: { label: "Open platform", href: site },
      };
  }
}

function layout(content: RenderedEmail) {
  const rows = content.rows?.length
    ? `<table role="presentation" width="100%" style="border-collapse:collapse;margin:16px 0;font-size:14px">
        ${content.rows
          .map(
            ([label, value]) => `<tr>
              <td style="padding:8px 12px;background:${BRAND.surface};color:${BRAND.muted};border-bottom:1px solid #e2e8f0;width:42%">${esc(label)}</td>
              <td style="padding:8px 12px;background:${BRAND.surface};color:${BRAND.ink};border-bottom:1px solid #e2e8f0">${esc(value)}</td>
            </tr>`,
          )
          .join("")}
      </table>`
    : "";

  const cta = content.cta
    ? `<a href="${esc(content.cta.href)}" style="display:inline-block;margin-top:20px;background:${BRAND.teal};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;font-size:14px">${esc(content.cta.label)}</a>`
    : "";

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(content.subject)}</title></head>
<body style="margin:0;padding:0;background:#eef2f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" style="background:#eef2f6;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,.08)">
        <tr><td style="background:${BRAND.ink};padding:20px 28px">
          <span style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:-.2px">Ibom Vendors Hub</span>
          <span style="color:${BRAND.gold};font-size:17px;font-weight:700">.</span>
        </td></tr>
        <tr><td style="padding:32px 28px">
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:${BRAND.ink}">${esc(content.heading)}</h1>
          <p style="margin:0;color:#334155;font-size:15px;line-height:1.65">${esc(content.intro)}</p>
          ${rows}
          ${cta}
          ${content.footnote ? `<p style="margin:22px 0 0;color:${BRAND.muted};font-size:12px;line-height:1.6">${esc(content.footnote)}</p>` : ""}
        </td></tr>
        <tr><td style="padding:18px 28px;background:${BRAND.surface};color:${BRAND.muted};font-size:11px;line-height:1.6">
          Ibom Vendors Hub — the multi-vendor marketplace for Akwa Ibom businesses.<br>
          This is an automated message. Reply to ${esc(url("/contact"))} for help.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    content.heading,
    "",
    content.intro,
    ...(content.rows ?? []).map(([label, value]) => `${label}: ${value}`),
    content.cta ? `\n${content.cta.label}: ${content.cta.href}` : "",
    content.footnote ? `\n${content.footnote}` : "",
    "\n— Ibom Vendors Hub",
  ]
    .filter(Boolean)
    .join("\n");

  return { html, text };
}

export interface SendEmailInput {
  to: string;
  template: string;
  data?: EmailData;
  dedupeKey?: string;
  storeId?: string | null;
}

export async function sendEmail(input: SendEmailInput) {
  const settings = await getSettings();
  const content = template(input.template, input.data ?? {});
  const { html, text } = layout(content);
  const from = emailFrom(settings);

  let logId: string | null = null;
  try {
    const inserted = await systemDb.maybeOne<{ id: string }>(
      `insert into email_logs (to_email, template, subject, html, text, status, provider, payload, dedupe_key)
       values ($1,$2,$3,$4,$5,'queued',$6,$7::jsonb,$8)
       on conflict (dedupe_key) do nothing
       returning id`,
      [
        input.to.toLowerCase(),
        input.template,
        content.subject,
        html,
        text,
        resendKey(settings) ? "resend" : "log",
        JSON.stringify(input.data ?? {}),
        input.dedupeKey ?? null,
      ],
    );
    if (!inserted) {
      return { skipped: true as const, reason: "duplicate", subject: content.subject };
    }
    logId = inserted.id;
  } catch (error) {
    console.error("email log failed", error);
    return { skipped: true as const, reason: "log-failed", subject: content.subject };
  }

  const key = resendKey(settings);
  if (!key) {
    // Development / unconfigured provider: the email is stored and visible in
    // Admin → Emails (and mirrored to the server log).
    await systemDb.execute(
      `update email_logs set status = 'skipped', error = 'No email provider configured' where id = $1`,
      [logId],
    );
    console.info(`[email:log] ${content.subject} → ${input.to}`);
    return { skipped: true as const, reason: "no-provider", subject: content.subject, id: logId };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [input.to], subject: content.subject, html, text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Resend ${response.status}: ${detail.slice(0, 300)}`);
    }
    const json = (await response.json()) as { id?: string };
    await systemDb.execute(
      `update email_logs set status = 'sent', sent_at = now(), provider_message_id = $2, attempts = attempts + 1 where id = $1`,
      [logId, json.id ?? null],
    );
    return { skipped: false as const, id: logId, subject: content.subject };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await systemDb.execute(
      `update email_logs set status = 'failed', error = $2, attempts = attempts + 1 where id = $1`,
      [logId, message.slice(0, 500)],
    );
    console.error("email send failed", message);
    return { skipped: false as const, id: logId, error: message, subject: content.subject };
  }
}

/** Retry failed/skipped emails — invoked by the scheduled job. */
export async function retryFailedEmails(limit = 20) {
  const settings = await getSettings();
  if (!resendKey(settings)) return { retried: 0, sent: 0 };
  const rows = await systemDb.query<{ id: string; to_email: string; subject: string; html: string | null; text: string | null; attempts: number }>(
    `select id, to_email, subject, html, text, attempts from email_logs
      where status = 'failed' and attempts < 3 order by created_at limit $1`,
    [limit],
  );
  let sent = 0;
  for (const row of rows) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey(settings)}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: emailFrom(settings),
          to: [row.to_email],
          subject: row.subject,
          html: row.html ?? "<p></p>",
          text: row.text ?? "",
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(await response.text());
      await systemDb.execute(
        `update email_logs set status='sent', sent_at=now(), attempts=attempts+1, error=null where id=$1`,
        [row.id],
      );
      sent += 1;
    } catch (error) {
      await systemDb.execute(
        `update email_logs set attempts = attempts + 1, error = $2 where id = $1`,
        [row.id, error instanceof Error ? error.message.slice(0, 500) : "retry failed"],
      );
    }
  }
  return { retried: rows.length, sent };
}

/* -------------------------------------------------------------------------- */
/* Paystack webhook signature verification                                    */
/* -------------------------------------------------------------------------- */
export function verifySignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature || !secret) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
