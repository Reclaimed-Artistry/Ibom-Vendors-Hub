"use server";

import { getCurrentUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/email";
import { url } from "@/lib/settings";
import { formatMoney } from "@/lib/utils";
import { getLoanAgentByEmail } from "@/lib/loan-agents";

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
  const isLoanAgent = Boolean(getLoanAgentByEmail(user.email));
  if (
    user.role !== "super_admin" &&
    user.role !== "admin" &&
    !isLoanAgent
  ) {
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

  // Notify the applicant when the loan is approved — include the approved
  // amount and a plain-language repayment plan based on their loan type.
  if (decision === "approve") {
    const applicant = await systemDb.maybeOne<{
      email: string | null;
      full_name: string;
    }>(
      `select u.email, l.full_name
         from loan_applications l
         left join users u on u.id = l.user_id
        where l.id = $1`,
      [applicationId],
    );
    if (applicant?.email) {
      const schedule = (JSON.parse(repaymentSchedule ?? "[]") as Array<{
        installment: number;
        due_offset_months: number;
        amount: number;
        description: string;
      }>).slice(0, 5); // show first 5 installments in the email

      const rows = [
        ["Application reference", applicationId],
        ["Loan type", existing.loan_type.replace("_", " ")],
        ["Duration", `${existing.duration_months} month${existing.duration_months === 1 ? "" : "s"}`],
        ["Approved amount", formatMoney(approvedAmount ?? 0, "NGN")],
        ["Monthly interest (10%)", formatMoney(approvedMonthlyInterest ?? 0, "NGN")],
        ["Total interest", formatMoney(approvedTotalInterest ?? 0, "NGN")],
        ["Total repayable", formatMoney(approvedTotalRepayable ?? 0, "NGN")],
        ["Monthly payment", formatMoney(approvedMonthlyPayment ?? 0, "NGN")],
        ["Repayment plan", (repaymentPlanType ?? "pure_loan").replace("_", " ")],
        ...schedule.map((item) => [
          `Month ${item.due_offset_months}`,
          `${item.description} — ${formatMoney(item.amount, "NGN")}`,
        ]),
      ];

      await sendEmail({
        to: applicant.email,
        template: "loan_approved",
        dedupeKey: `loan-approved-${applicationId}`,
        data: {
          name: applicant.full_name,
          email: applicant.email,
          subject: "Your loan has been approved",
          message: `Great news — your loan application has been approved.`,
          applicationReference: applicationId,
          loanType: existing.loan_type.replace("_", " "),
          durationMonths: String(existing.duration_months),
          approvedAmount: formatMoney(approvedAmount ?? 0, "NGN"),
          monthlyInterest: formatMoney(approvedMonthlyInterest ?? 0, "NGN"),
          totalInterest: formatMoney(approvedTotalInterest ?? 0, "NGN"),
          totalRepayable: formatMoney(approvedTotalRepayable ?? 0, "NGN"),
          monthlyPayment: formatMoney(approvedMonthlyPayment ?? 0, "NGN"),
          repaymentPlanType: (repaymentPlanType ?? "pure_loan").replace("_", " "),
          rows,
          link: url("/account/loans"),
        },
      }).catch((err) => console.error("loan approval email failed", err));
    }
  }

  return {
    message: `Application ${decision}d successfully.${decision === "approve" ? ` Approved amount: ₦${approvedAmount?.toLocaleString()}. Repayment plan: ${(repaymentPlanType ?? "pure_loan").replace("_", " ")}.` : ""} The applicant will be notified.`,
  };
}
