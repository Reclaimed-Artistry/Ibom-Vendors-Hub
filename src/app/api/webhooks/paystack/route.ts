import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { paystackSecret } from "@/lib/settings";
import { failPayment, getPayment, markPaymentSuccessful } from "@/lib/payments";
import { verifyPaystackSignature } from "@/lib/payments/gateway";

export const dynamic = "force-dynamic";

/**
 * Paystack webhook.
 *
 * Security: the raw body is validated against the HMAC-SHA512 signature using
 * the platform secret key before anything is read, the amount is compared with
 * the persisted payment record, and processing is idempotent.
 */
export async function POST(request: Request) {
  const settings = await getSettings();
  const secret = paystackSecret(settings);
  if (!secret) {
    return NextResponse.json({ error: "Paystack is not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");
  if (!verifyPaystackSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string; amount?: number; status?: string; channel?: string; currency?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const reference = event.data?.reference;
  if (!reference) return NextResponse.json({ received: true });

  const payment = await getPayment(reference);
  if (!payment) {
    return NextResponse.json({ received: true, note: "unknown reference" });
  }

  if (event.event === "charge.success") {
    const paid = Number(event.data?.amount ?? 0) / 100;
    if (Math.abs(paid - Number(payment.amount)) > 0.01) {
      await failPayment(reference, "Webhook amount does not match the payment record", event as Record<string, unknown>);
      return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
    }
    await markPaymentSuccessful(reference, {
      channel: event.data?.channel,
      providerReference: reference,
      raw: event as Record<string, unknown>,
      via: "webhook",
    });
  }

  if (event.event === "charge.failed") {
    await failPayment(reference, "Payment failed at the gateway", event as Record<string, unknown>);
  }

  return NextResponse.json({ received: true });
}
