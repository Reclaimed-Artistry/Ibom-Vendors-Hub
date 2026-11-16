import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Payment gateway abstraction.
 *
 * Paystack is the primary provider. When no Paystack secret key is configured
 * the platform uses a clearly-labelled *sandbox* gateway that still requires
 * server-side verification of a persisted payment record before anything is
 * marked as paid — no flow trusts a browser redirect.
 */

export type ProviderName = "paystack" | "sandbox";

export interface InitInput {
  reference: string;
  amount: number;
  email: string;
  currency: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
  secretKey: string;
}

export interface InitResult {
  provider: ProviderName;
  authorizationUrl: string;
  providerReference?: string;
}

export interface VerifyInput {
  reference: string;
  expectedAmount: number;
  expectedCurrency: string;
  secretKey: string;
}

export interface VerifyResult {
  success: boolean;
  amount: number;
  currency: string;
  channel?: string;
  providerReference?: string;
  failureReason?: string;
  raw: Record<string, unknown>;
}

const PAYSTACK_BASE = "https://api.paystack.co";

export function providerFor(secretKey: string | null | undefined): ProviderName {
  return secretKey ? "paystack" : "sandbox";
}

export async function initializeTransaction(input: InitInput): Promise<InitResult> {
  if (!input.secretKey) {
    return { provider: "sandbox", authorizationUrl: `/pay/${input.reference}` };
  }

  const response = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      amount: Math.round(input.amount * 100),
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata ?? {},
    }),
    signal: AbortSignal.timeout(20_000),
  });

  const json = (await response.json().catch(() => ({}))) as {
    status?: boolean;
    message?: string;
    data?: { authorization_url?: string; access_code?: string; reference?: string };
  };

  if (!response.ok || !json.status || !json.data?.authorization_url) {
    throw new Error(json.message ?? "Unable to start the payment. Please try again.");
  }

  return {
    provider: "paystack",
    authorizationUrl: json.data.authorization_url,
    providerReference: json.data.reference ?? input.reference,
  };
}

export async function verifyTransaction(input: VerifyInput): Promise<VerifyResult> {
  const response = await fetch(
    `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(input.reference)}`,
    {
      headers: { Authorization: `Bearer ${input.secretKey}` },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    },
  );

  const json = (await response.json().catch(() => ({}))) as {
    status?: boolean;
    message?: string;
    data?: {
      status?: string;
      amount?: number;
      currency?: string;
      channel?: string;
      reference?: string;
      gateway_response?: string;
      paid_at?: string;
    };
  };

  const data = json.data;
  if (!response.ok || !json.status || !data) {
    return {
      success: false,
      amount: 0,
      currency: input.expectedCurrency,
      failureReason: json.message ?? "Payment could not be verified",
      raw: json as Record<string, unknown>,
    };
  }

  const paidAmount = Number(data.amount ?? 0) / 100;
  const amountMatches = Math.abs(paidAmount - input.expectedAmount) < 0.01;
  const currencyMatches =
    !data.currency || data.currency.toUpperCase() === input.expectedCurrency.toUpperCase();
  const success = data.status === "success" && amountMatches && currencyMatches;

  return {
    success,
    amount: paidAmount,
    currency: data.currency ?? input.expectedCurrency,
    channel: data.channel,
    providerReference: data.reference,
    failureReason: success
      ? undefined
      : !amountMatches
        ? "Amount paid does not match the order total"
        : !currencyMatches
          ? "Currency mismatch"
          : (data.gateway_response ?? "Payment was not successful"),
    raw: json as Record<string, unknown>,
  };
}

export function verifyPaystackSignature(
  rawBody: string,
  signature: string | null,
  secretKey: string,
) {
  if (!signature || !secretKey) return false;
  const expected = createHmac("sha512", secretKey).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface GatewayCheck {
  ok: boolean;
  balances?: Array<{ currency: string; balance: number }>;
  error?: string;
}

/**
 * Proves the configured secret key actually authenticates with Paystack.
 *
 * A key can be well-formed and still be revoked, from another account or from
 * the wrong mode, and that only shows up when a customer tries to pay. Admin →
 * Payments runs this against Paystack's /balance endpoint, which needs nothing
 * but the secret key and never moves money.
 */
export async function checkPaystackCredentials(secretKey: string): Promise<GatewayCheck> {
  if (!secretKey) return { ok: false, error: "No Paystack secret key configured" };
  try {
    const response = await fetch(`${PAYSTACK_BASE}/balance`, {
      headers: { Authorization: `Bearer ${secretKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await response.json().catch(() => ({}))) as {
      status?: boolean;
      message?: string;
      data?: Array<{ currency?: string; balance?: number }>;
    };
    if (!response.ok || !json.status) {
      return {
        ok: false,
        error: `Paystack ${response.status}: ${json.message ?? "the key was rejected"}`,
      };
    }
    return {
      ok: true,
      balances: (json.data ?? []).map((row) => ({
        currency: row.currency ?? "NGN",
        balance: Number(row.balance ?? 0) / 100,
      })),
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Paystack could not be reached" };
  }
}
