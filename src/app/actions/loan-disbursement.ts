"use server";

import { getCurrentUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { revalidatePath } from "next/cache";

export interface DisbursementState {
  error?: string;
  message?: string;
}

/**
 * Marks an approved, assessed loan application as disbursed (funds sent).
 */
export async function disburseLoanAction(
  _prev: DisbursementState,
  form: FormData,
): Promise<DisbursementState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Please sign in before disbursing funds." };
  }
  if (user.role !== "super_admin" && user.role !== "admin") {
    return { error: "Not authorised to disburse loans." };
  }

  const applicationId = String(form.get("application_id") ?? "").trim();
  if (!applicationId) {
    return { error: "Missing loan application." };
  }

  const updated = await systemDb.maybeOne<{ id: string }>(
    `update loan_applications
      set money_sent = true,
          status = 'disbursed',
          updated_at = now()
      where id = $1
        and assessment_status = 'completed'
        and agent_decision = 'approve'
        and money_sent = false
      returning id`,
    [applicationId],
  );

  if (!updated) {
    return {
      error:
        "Cannot disburse: the application must be assessed and approved first, and funds must not already have been sent.",
    };
  }

  revalidatePath(`/admin/loan-assessments/${applicationId}`);
  revalidatePath("/admin/loan-assessments");
  return { message: "Funds marked as disbursed." };
}

/**
 * Marks a disbursed loan application as fully repaid.
 */
export async function markLoanRepaidAction(
  _prev: DisbursementState,
  form: FormData,
): Promise<DisbursementState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Please sign in before updating repayment status." };
  }
  if (user.role !== "super_admin" && user.role !== "admin") {
    return { error: "Not authorised to update loan repayment status." };
  }

  const applicationId = String(form.get("application_id") ?? "").trim();
  if (!applicationId) {
    return { error: "Missing loan application." };
  }

  const updated = await systemDb.maybeOne<{ id: string }>(
    `update loan_applications
      set loan_paid_off = true,
          status = 'repaid',
          updated_at = now()
      where id = $1
        and money_sent = true
        and loan_paid_off = false
      returning id`,
    [applicationId],
  );

  if (!updated) {
    return {
      error:
        "Cannot mark as repaid: funds must have been disbursed and the loan not already marked repaid.",
    };
  }

  revalidatePath(`/admin/loan-assessments/${applicationId}`);
  revalidatePath("/admin/loan-assessments");
  return { message: "Loan marked as repaid." };
}
