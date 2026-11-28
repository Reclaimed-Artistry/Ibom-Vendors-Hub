"use server";

import { getCurrentUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { revalidatePath } from "next/cache";

export interface AssessmentState {
  error?: string;
  message?: string;
}

const MONTHLY_INTEREST_RATE = 10; // fixed 10% per month

/**
 * Builds a repayment schedule based on loan type.
 *
 * - pure_loan: Equal monthly installments of (principal + total interest) / duration.
 *   Each payment reduces both principal and interest.
 *
 * - financial_lease: Interest-only monthly payments (principal * 10%),
 *   with the full principal due as a balloon payment at the end of the term.
 */
function buildRepaymentSchedule(
  loanType: string,
  approvedAmount: number,
  durationMonths: number,
  monthlyInterest: number,
  totalRepayable: number,
): { planType: string; schedule: Array<{ installment: number; due_offset_months: number; amount: number; description: string }> } {
  const schedule: Array<{
    installment: number;
    due_offset_months: number;
    amount: number;
    description: string;
  }> = [];

  if (loanType === "financial_lease") {
    // Interest-only monthly payments + balloon principal at end
    for (let i = 1; i <= durationMonths; i++) {
      if (i < durationMonths) {
        schedule.push({
          installment: i,
          due_offset_months: i,
          amount: Math.round(monthlyInterest * 100) / 100,
          description: `Month ${i} — interest only`,
        });
      } else {
        // Final month: interest + full principal (balloon)
        schedule.push({
          installment: i,
          due_offset_months: i,
          amount: Math.round((monthlyInterest + approvedAmount) * 100) / 100,
          description: `Month ${i} — interest + principal (balloon)`,
        });
      }
    }
    return {
      planType: "financial_lease",
      schedule,
    };
  }

  // pure_loan: equal monthly installments
  const monthlyPayment = Math.round((totalRepayable / durationMonths) * 100) / 100;
  for (let i = 1; i <= durationMonths; i++) {
    schedule.push({
      installment: i,
      due_offset_months: i,
      amount: monthlyPayment,
      description: `Month ${i} — principal + interest`,
    });
  }
  return { planType: "pure_loan", schedule };
}

/**
 * Records a loan officer's assessment decision on a loan application.
 *
 * Expects FormData fields:
 *   - application_id        (hidden)
 *   - decision              ("approve" | "reject")
 *   - approved_amount       (number, required when decision = "approve")
 *   - assessment_notes      (textarea)
 *   - physical_visit_date   (date, optional)
 */
export async function submitLoanAssessmentAction(
  _prev: AssessmentState,
  form: FormData,
): Promise<AssessmentState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Please sign in before assessing a loan." };
  }
  if (user.role !== "super_admin" && user.role !== "admin") {
    return { error: "Not authorised to assess loans." };
  }

  const applicationId = String(form.get("application_id") ?? "").trim();
  const decision = String(form.get("decision") ?? "").trim();
  const approvedAmountRaw = String(form.get("approved_amount") ?? "").trim();
  const assessmentNotes = String(form.get("assessment_notes") ?? "").trim();
  const physicalVisitDate =
    String(form.get("physical_visit_date") ?? "").trim() || null;

  if (!applicationId) {
    return { error: "Missing loan application." };
  }
  if (decision !== "approve" && decision !== "reject") {
    return { error: "Select Approve or Reject before submitting." };
  }

  // Fetch the existing application to recalculate terms based on approved amount.
  const existing = await systemDb.maybeOne<{
    id: string;
    loan_amount_figures: number;
    loan_type: string;
    duration_months: number;
  }>(
    `select id, loan_amount_figures, loan_type, duration_months
       from loan_applications
      where id = $1`,
    [applicationId],
  );
  if (!existing) {
    return { error: "Loan application not found." };
  }

  let approvedAmount: number | null = null;
  let approvedMonthlyInterest: number | null = null;
  let approvedTotalInterest: number | null = null;
  let approvedTotalRepayable: number | null = null;
  let approvedMonthlyPayment: number | null = null;
  let repaymentPlanType: string | null = null;
  let repaymentSchedule: string | null = null;

  if (decision === "approve") {
    if (!approvedAmountRaw) {
      return { error: "Enter the approved loan amount before submitting." };
    }
    approvedAmount = Number(approvedAmountRaw);
    if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) {
      return { error: "Enter a valid approved loan amount." };
    }
    if (approvedAmount > existing.loan_amount_figures) {
      return {
        error: `Approved amount (₦${approvedAmount.toLocaleString()}) cannot exceed the applied amount (₦${existing.loan_amount_figures.toLocaleString()}).`,
      };
    }

    // Recalculate based on approved amount at 10% per month
    approvedMonthlyInterest = Math.round((approvedAmount * (MONTHLY_INTEREST_RATE / 100)) * 100) / 100;
    approvedTotalInterest = Math.round((approvedMonthlyInterest * existing.duration_months) * 100) / 100;
    approvedTotalRepayable = Math.round(((approvedAmount + approvedTotalInterest) * 100)) / 100;

    // Build repayment schedule based on loan type
    const plan = buildRepaymentSchedule(
      existing.loan_type,
      approvedAmount,
      existing.duration_months,
      approvedMonthlyInterest,
      approvedTotalRepayable,
    );
    repaymentPlanType = plan.planType;
    repaymentSchedule = JSON.stringify(plan.schedule);

    // Approved monthly payment = first installment amount (same for pure_loan, interest-only for financial_lease)
    approvedMonthlyPayment = plan.schedule[0]?.amount ?? null;
  }

  const updated = await systemDb.maybeOne<{ id: string }>(
    `update loan_applications
      set assessment_status = 'completed',
          agent_decision = $1,
          agent_decision_notes = $2,
          physical_visit_date = $3,
          assessed_at = now(),
          assessed_by = $4,
          approved_amount = $5,
          approved_monthly_interest = $6,
          approved_total_interest = $7,
          approved_total_repayable = $8,
          approved_monthly_payment = $9,
          repayment_plan_type = $10,
          repayment_schedule = $11,
          agent_approved_at = $12,
          updated_at = now()
      where id = $13
      returning id`,
    [
      decision,
      assessmentNotes,
      physicalVisitDate,
      user.id,
      approvedAmount,
      approvedMonthlyInterest,
      approvedTotalInterest,
      approvedTotalRepayable,
      approvedMonthlyPayment,
      repaymentPlanType,
      repaymentSchedule,
      decision === "approve" ? new Date().toISOString() : null,
      applicationId,
    ],
  );

  if (!updated) {
    return { error: "Loan application not found." };
  }

  revalidatePath(`/admin/loan-assessments/${applicationId}`);
  revalidatePath("/admin/loan-assessments");
  revalidatePath("/agent/loans");

  return {
    message: `Application ${decision}d successfully.${decision === "approve" ? ` Approved amount: ₦${approvedAmount?.toLocaleString()}. Repayment plan: ${(repaymentPlanType ?? "pure_loan").replace("_", " ")}.` : ""} The applicant will be notified.`,
  };
}
