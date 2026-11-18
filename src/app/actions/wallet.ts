"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { systemDb, withSystem } from "@/lib/db";
import { getSettings, paystackSecret, url } from "@/lib/settings";
import { initializeTransaction } from "@/lib/payments/gateway";
import { payWithWalletCheckout } from "@/lib/wallet-payments";
import type { PublicState } from "@/app/actions/public";

/* -------------------------------------------------------------------------- */
/* Wallet top-up                                                            */
/* -------------------------------------------------------------------------- */

export interface WalletState {
  error?: string;
  message?: string;
  redirectUrl?: string;
}

/** Customer initiates a wallet top-up. Creates a pending `wallet` payment
 *  record, starts a Paystack (or sandbox) transaction, and returns the URL to
 *  redirect the customer to. */
export async function fundWalletAction(
  _prev: WalletState,
  formData: FormData,
): Promise<WalletState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Please sign in to your account before funding your wallet." };
  }

  const amount = Number(formData.get("amount") ?? "");
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid amount greater than ₦0." };
  }

  try {
    const result = await withSystem(async (db) => {
      const settings = await getSettings();
      const reference = (
        await db.one<{ ref: string }>(`select next_payment_reference('WAL') as ref`)
      ).ref;

      const payment = await db.one<{ id: string }>(
        `insert into payments (reference, scope, provider, checkout_reference, payer_user_id, payer_email, amount, currency, status, metadata)
         values ($1,'wallet',$2,null,$3,$4,$5,$6,'pending',$7::jsonb)
         returning id`,
        [
          reference,
          paystackSecret(settings) ? "paystack" : "sandbox",
          user.id,
          user.email,
          amount,
          settings.currency,
          JSON.stringify({ purpose: "wallet_top_up" }),
        ],
      );

      const init = await initializeTransaction({
        reference,
        amount,
        email: user.email,
        currency: settings.currency,
        callbackUrl: url(`/pay/callback?reference=${reference}`),
        metadata: { purpose: "wallet_top_up", userId: user.id },
        secretKey: paystackSecret(settings),
      });
      await systemDb.execute(
        `update payments set authorization_url = $2 where id = $1`,
        [payment.id, init.authorizationUrl],
      );
      return { reference, authorizationUrl: init.authorizationUrl };
    });

    return { redirectUrl: result.authorizationUrl };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not start the wallet top-up.",
    };
  }
}

/** Get the signed-in customer's current wallet balance (₦0 if none exists). */
export async function getWalletBalance(userId: string): Promise<number> {
  const row = await systemDb.maybeOne<{ balance: number }>(
    `select coalesce(balance, 0) as balance from wallets where user_id = $1`,
    [userId],
  );
  return Number(row?.balance ?? 0);
}

/** Recent wallet transactions for the signed-in customer. */
export async function getWalletTransactions(
  userId: string,
  limit = 20,
) {
  return systemDb.query<{
    id: string;
    type: string;
    amount: number;
    reference: string;
    description: string | null;
    status: string;
    created_at: string;
  }>(
    `select t.id, t.type, t.amount, t.reference, t.description, t.status, t.created_at
       from wallet_transactions t
       join wallets w on w.id = t.wallet_id
      where w.user_id = $1
      order by t.created_at desc
      limit $2`,
    [userId, limit],
  );
}

/* -------------------------------------------------------------------------- */
/* Pay with wallet at checkout                                              */
/* -------------------------------------------------------------------------- */

/** Deduct the wallet balance and mark the checkout's orders as paid.
 *  Used when a customer chooses to pay with their wallet instead of Paystack. */
/** Server action wrapper so a checkout form can submit a wallet payment. */
export async function payWithWalletCheckoutAction(
  _prev: PublicState,
  formData: FormData,
): Promise<PublicState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Please sign in to your account.", redirectUrl: "/login?next=%2Fcheckout" };
  }

  const checkoutReference = String(formData.get("checkoutReference") ?? "");
  const grandTotal = Number(formData.get("grandTotal") ?? "");
  if (!checkoutReference || !Number.isFinite(grandTotal) || grandTotal <= 0) {
    return { error: "Invalid checkout. Please refresh and try again." };
  }

  try {
    await payWithWalletCheckout({
      userId: user.id,
      email: user.email,
      checkoutReference,
      grandTotal,
    });
    revalidatePath("/account/wallet");
    revalidatePath("/account/orders");
    return {
      message: `Paid ₦${grandTotal.toLocaleString()} from your wallet. Your order is confirmed.`,
      redirectUrl: "/account/orders",
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Wallet payment failed. Please try again.",
    };
  }
}
