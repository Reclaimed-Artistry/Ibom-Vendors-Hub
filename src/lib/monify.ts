/**
 * Monify payment gateway client.
 *
 * Configuration (set as environment variables, never committed):
 *   MONIFY_API_KEY        public API key
 *   MONIFY_SECRET_KEY     secret key used to sign/authorise requests
 *   MONIFY_CONTRACT_CODE  merchant contract code
 *
 * When any of these are missing the platform keeps working: payment
 * initialisation returns a graceful error instead of throwing, so flows
 * remain testable without a live Monify account.
 */
const MONIFY_BASE_URL = "https://api.monify.com";

export interface MonifyPaymentInput {
  amount: number;
  customerEmail: string;
  customerName: string;
  paymentReference: string;
  paymentDescription?: string;
  redirectUrl?: string;
  currency?: string;
  phoneNumber?: string;
  metadata?: Record<string, unknown>;
}

export interface MonifyInitResult {
  checkoutUrl?: string;
  paymentReference?: string;
  error?: string;
}

export interface MonifyVerifyResult {
  paid?: boolean;
  error?: string;
}

function monifyConfig() {
  return {
    apiKey: process.env.MONIFY_API_KEY,
    secretKey: process.env.MONIFY_SECRET_KEY,
    contractCode: process.env.MONIFY_CONTRACT_CODE,
  };
}

export function isMonifyConfigured(): boolean {
  const { apiKey, secretKey, contractCode } = monifyConfig();
  return Boolean(apiKey && secretKey && contractCode);
}

/**
 * Initialise a Monify checkout and return the checkout URL to redirect the
 * payer to. Returns `{ error }` when Monify is not configured or the request
 * fails — callers must handle both shapes.
 */
export async function initializeMonifyPayment(
  input: MonifyPaymentInput,
): Promise<MonifyInitResult> {
  const { apiKey, secretKey, contractCode } = monifyConfig();
  if (!apiKey || !secretKey || !contractCode) {
    return {
      error:
        "Monify is not configured on this platform. Set MONIFY_API_KEY, MONIFY_SECRET_KEY and MONIFY_CONTRACT_CODE.",
    };
  }

  try {
    const res = await fetch(
      `${MONIFY_BASE_URL}/merchants/${contractCode}/transactions/init`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secretKey}`,
        },
        body: JSON.stringify({
          amount: input.amount,
          customerEmail: input.customerEmail,
          customerName: input.customerName,
          paymentReference: input.paymentReference,
          paymentDescription: input.paymentDescription ?? "Loan repayment",
          redirectUrl: input.redirectUrl,
          currency: input.currency ?? "NGN",
          phoneNumber: input.phoneNumber,
          metadata: input.metadata ?? {},
        }),
      },
    );

    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const data = (body?.data ?? body) as Record<string, unknown> | undefined;

    if (!res.ok) {
      return {
        error:
          (data?.message as string | undefined) ??
          (body?.error as string | undefined) ??
          `Monify initialisation failed (HTTP ${res.status})`,
      };
    }

    const checkoutUrl =
      (data?.checkoutUrl as string | undefined) ??
      (body?.checkoutUrl as string | undefined);
    const paymentReference =
      (data?.paymentReference as string | undefined) ??
      input.paymentReference;

    if (!checkoutUrl) {
      return { error: "Monify did not return a checkout URL." };
    }

    return { checkoutUrl, paymentReference };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Monify initialisation failed.",
    };
  }
}

/**
 * Verify a Monify transaction by reference. Returns `{ paid }` or `{ error }`.
 */
export async function verifyMonifyPayment(
  reference: string,
): Promise<MonifyVerifyResult> {
  const { apiKey, secretKey, contractCode } = monifyConfig();
  if (!apiKey || !secretKey || !contractCode) {
    return { error: "Monify is not configured on this platform." };
  }

  try {
    const res = await fetch(
      `${MONIFY_BASE_URL}/merchants/${contractCode}/transactions/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
      },
    );

    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const data = (body?.data ?? body) as Record<string, unknown> | undefined;

    if (!res.ok) {
      return {
        error:
          (data?.message as string | undefined) ??
          `Monify verification failed (HTTP ${res.status})`,
      };
    }

    const paid =
      data?.paid === true ||
      data?.status === "paid" ||
      data?.paymentStatus === "paid";

    return { paid };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Monify verification failed.",
    };
  }
}
