"use server";

import { getCurrentUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { initializeMonifyPayment } from "@/lib/monify";

export interface LoanRepaymentState {
  checkoutUrl?: string;
  error?: string;
  message?: string;
}

/**
 * Initialise a Monify checkout for a loan repayment.
 *
 * Expects FormData fields:
 *   - application_id (hidden) — the loan application being repaid
 *   - amount_to_pay  (hidden) — amount in the minor currency unit (NGN)
 *   - phone_number   — payer's phone number
 *
 * Returns { checkoutUrl } on success so the client can redirect to Monify,
 * or { error } / { message } otherwise.
 */
export async function initiateLoanRepaymentAction(
  _prev: LoanRepaymentState,
  form: FormData,
): Promise<LoanRepaymentState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Please sign in before making a repayment." };
  }

  const applicationId = String(form.get("application_id") ?? "").trim();
  const amountToPay = Number(form.get("amount_to_pay"));
  const phoneNumber = String(form.get("phone_number") ?? "").trim();

  if (!applicationId) {
    return { error: "Missing loan application." };
  }
  if (!Number.isFinite(amountToPay) || amountToPay <= 0) {
    return { error: "Enter a valid amount to pay." };
  }
  if (!phoneNumber) {
    return { error: "Phone number is required." };
  }

  // Confirm the application exists and belongs to the signed-in user.
  const loan = await systemDb.maybeOne<{
    id: string;
    user_id: string;
    status: string;
    total_repayable: number;
    amount_paid: number;
  }>(
    `select id, user_id, status, total_repayable, amount_paid
       from loan_applications
      where id = $1`,
    [applicationId],
  );

  if (!loan) {
    return { error: "Loan application not found." };
  }
  if (loan.user_id !== user.id) {
    return { error: "Not authorised to repay this loan." };
  }

  const remaining = Number(loan.total_repayable) - Number(loan.amount_paid);
  if (amountToPay > remaining) {
    return { error: "Amount to pay exceeds the outstanding balance." };
  }

  const reference = `LR-${applicationId}-${Date.now()}`;
  const appUrl = String(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  const redirectUrl = `${appUrl}/account/loan-repayment-callback`;

  const result = await initializeMonifyPayment({
    amount: amountToPay,
    customerEmail: user.email,
    customerName: user.fullName,
    paymentReference: reference,
    paymentDescription: `Loan repayment for application ${applicationId}`,
    redirectUrl,
    phoneNumber,
    metadata: { applicationId, userId: user.id },
  });

  if (result.error) {
    return { error: result.error };
  }
  if (!result.checkoutUrl) {
    return { error: "Could not initialise payment with Monify." };
  }

  revalidatePath("/account");
  return {
    checkoutUrl: result.checkoutUrl,
    message: "Redirecting to Monify…",
  };
}
