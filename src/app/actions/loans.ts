"use server";

import { getCurrentUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { uploadImage } from "@/lib/storage";
import { sendEmail } from "@/lib/email";
import { url } from "@/lib/settings";
import { formatMoney } from "@/lib/utils";
import { selectLoanAgent } from "@/lib/loan-agents";

export interface LoanState {
  error?: string;
  message?: string;
  reference?: string;
  fieldErrors?: Record<string, string>;
}

const MONTHLY_INTEREST_RATE = 10; // fixed 10% per month

async function uploadPassport(file: unknown, label: string): Promise<string> {
  if (!(file instanceof File) || file.size === 0) {
    throw new Error(`${label} passport photograph is required.`);
  }
  return uploadImage(file, `loan-passports`);
}

export async function saveLoanApplicationAction(
  _prev: LoanState,
  form: FormData,
): Promise<LoanState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Please sign in before applying for a loan." };
  }

  const userRole = user.role === "vendor" ? "vendor" : "customer";

  const loanAmountFigures = Number(form.get("loan_amount_figures"));
  if (!Number.isFinite(loanAmountFigures) || loanAmountFigures <= 0) {
    return { error: "Enter a valid loan amount." };
  }

  const loanType = String(form.get("loan_type") ?? "").trim();
  if (loanType !== "financial_lease" && loanType !== "pure_loan") {
    return { error: "Select a loan type (Financial Lease or Pure Loan)." };
  }

  const durationMonths = Number(form.get("duration_months"));
  if (!Number.isFinite(durationMonths) || durationMonths < 1 || durationMonths > 12) {
    return { error: "Select a loan duration between 1 and 12 months." };
  }

  const termsAccepted = form.get("terms_accepted") === "on";
  if (!termsAccepted) {
    return { error: "You must accept the Terms & Conditions before submitting." };
  }

  // --- Field-level validation: point out every missing required field -----
  const fieldErrors: Record<string, string> = {};

  const requiredStringFields: Array<{ name: string; label: string; value: FormDataEntryValue | null }> = [
    { name: "full_name", label: "Full Name", value: form.get("full_name") },
    { name: "native_of", label: "Native of (Town)", value: form.get("native_of") },
    { name: "lga", label: "L.G.A.", value: form.get("lga") },
    { name: "state", label: "State", value: form.get("state") },
    { name: "residential_address", label: "Residential Address", value: form.get("residential_address") },
    { name: "phone_1", label: "Phone Number (1)", value: form.get("phone_1") },
    { name: "id_number", label: "ID Number", value: form.get("id_number") },
    { name: "sex", label: "Sex", value: form.get("sex") },
    { name: "date_of_birth", label: "Date of Birth", value: form.get("date_of_birth") },
    { name: "occupation", label: "Occupation / Post", value: form.get("occupation") },
    { name: "religion", label: "Religion", value: form.get("religion") },
    { name: "worship_with", label: "Worship With", value: form.get("worship_with") },
    { name: "post_position", label: "Post / Position", value: form.get("post_position") },
    { name: "church_address", label: "Church Address", value: form.get("church_address") },
    { name: "surety1_title", label: "Surety 1 - Title", value: form.get("surety1_title") },
    { name: "surety1_full_name", label: "Surety 1 - Full Name", value: form.get("surety1_full_name") },
    { name: "surety1_family", label: "Surety 1 - Family Name", value: form.get("surety1_family") },
    { name: "surety1_native_of", label: "Surety 1 - Native of (Town)", value: form.get("surety1_native_of") },
    { name: "surety1_lga", label: "Surety 1 - L.G.A.", value: form.get("surety1_lga") },
    { name: "surety1_state", label: "Surety 1 - State", value: form.get("surety1_state") },
    { name: "surety1_address", label: "Surety 1 - Residential Address", value: form.get("surety1_address") },
    { name: "surety1_phone_1", label: "Surety 1 - Phone Number (1)", value: form.get("surety1_phone_1") },
    { name: "surety1_id_number", label: "Surety 1 - ID Number", value: form.get("surety1_id_number") },
    { name: "surety1_sex", label: "Surety 1 - Sex", value: form.get("surety1_sex") },
    { name: "surety1_date_of_birth", label: "Surety 1 - Date of Birth", value: form.get("surety1_date_of_birth") },
    { name: "surety1_occupation", label: "Surety 1 - Occupation / Post", value: form.get("surety1_occupation") },
    { name: "surety1_religion", label: "Surety 1 - Religion", value: form.get("surety1_religion") },
    { name: "surety1_worship_with", label: "Surety 1 - Worship With", value: form.get("surety1_worship_with") },
    { name: "surety1_post_position", label: "Surety 1 - Post / Position", value: form.get("surety1_post_position") },
    { name: "surety1_church_address", label: "Surety 1 - Church Address", value: form.get("surety1_church_address") },
    { name: "surety2_title", label: "Surety 2 - Title", value: form.get("surety2_title") },
    { name: "surety2_full_name", label: "Surety 2 - Full Name", value: form.get("surety2_full_name") },
    { name: "surety2_family", label: "Surety 2 - Family Name", value: form.get("surety2_family") },
    { name: "surety2_native_of", label: "Surety 2 - Native of (Town)", value: form.get("surety2_native_of") },
    { name: "surety2_lga", label: "Surety 2 - L.G.A.", value: form.get("surety2_lga") },
    { name: "surety2_state", label: "Surety 2 - State", value: form.get("surety2_state") },
    { name: "surety2_address", label: "Surety 2 - Residential Address", value: form.get("surety2_address") },
    { name: "surety2_phone_1", label: "Surety 2 - Phone Number (1)", value: form.get("surety2_phone_1") },
    { name: "surety2_id_number", label: "Surety 2 - ID Number", value: form.get("surety2_id_number") },
    { name: "surety2_sex", label: "Surety 2 - Sex", value: form.get("surety2_sex") },
    { name: "surety2_date_of_birth", label: "Surety 2 - Date of Birth", value: form.get("surety2_date_of_birth") },
    { name: "surety2_occupation", label: "Surety 2 - Occupation / Post", value: form.get("surety2_occupation") },
    { name: "surety2_religion", label: "Surety 2 - Religion", value: form.get("surety2_religion") },
    { name: "surety2_worship_with", label: "Surety 2 - Worship With", value: form.get("surety2_worship_with") },
    { name: "surety2_post_position", label: "Surety 2 - Post / Position", value: form.get("surety2_post_position") },
    { name: "surety2_church_address", label: "Surety 2 - Church Address", value: form.get("surety2_church_address") },
    { name: "loan_amount_words", label: "Loan Amount (Words)", value: form.get("loan_amount_words") },
    { name: "loan_type", label: "Loan Type", value: form.get("loan_type") },
    { name: "duration_months", label: "Loan Duration (months)", value: form.get("duration_months") },
    { name: "repayment_frequency", label: "Repayment Frequency", value: form.get("repayment_frequency") },
    { name: "date_received", label: "Date Received", value: form.get("date_received") },
    { name: "creditor_name", label: "Creditor / Lender Name", value: form.get("creditor_name") },
    { name: "bank_name", label: "Bank Name", value: form.get("bank_name") },
    { name: "account_name", label: "Account Name", value: form.get("account_name") },
    { name: "account_number", label: "Account Number", value: form.get("account_number") },
  ];

  for (const field of requiredStringFields) {
    const val = String(field.value ?? "").trim();
    if (!val) {
      fieldErrors[field.name] = `${field.label} is required.`;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      error: "Please fill in all required fields marked with *.",
      fieldErrors,
    };
  }

  // Creditor/lender is always MONEY STEWARD.
  const creditorName = String(form.get("creditor_name") ?? "MONEY STEWARD").trim() || "MONEY STEWARD";

  // Fixed 10% per month, auto-calculated from the loan amount.
  const interestRate = MONTHLY_INTEREST_RATE;
  const monthlyInterestAmount = loanAmountFigures * (interestRate / 100);
  const totalInterest = monthlyInterestAmount * durationMonths;
  const totalRepayable = loanAmountFigures + totalInterest;

  // --- Passport photo uploads (applicant + 2 sureties) ---------------------
  const applicantPassport = form.get("applicant_passport") as File | null;
  const surety1Passport = form.get("surety1_passport") as File | null;
  const surety2Passport = form.get("surety2_passport") as File | null;

  // File uploads are required too.
  if (!(applicantPassport instanceof File) || applicantPassport.size === 0) {
    fieldErrors["applicant_passport"] = "Applicant Passport Photograph is required.";
  }
  if (!(surety1Passport instanceof File) || surety1Passport.size === 0) {
    fieldErrors["surety1_passport"] = "Surety 1 Passport Photograph is required.";
  }
  if (!(surety2Passport instanceof File) || surety2Passport.size === 0) {
    fieldErrors["surety2_passport"] = "Surety 2 Passport Photograph is required.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      error: "Please fill in all required fields marked with *.",
      fieldErrors,
    };
  }

  let applicantPassportUrl: string | null = null;
  let surety1PassportUrl: string | null = null;
  let surety2PassportUrl: string | null = null;

  try {
    applicantPassportUrl = await uploadPassport(applicantPassport, "Applicant");
    surety1PassportUrl = await uploadPassport(surety1Passport, "Surety 1");
    surety2PassportUrl = await uploadPassport(surety2Passport, "Surety 2");
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not upload passport photographs.",
    };
  }

  try {
    // Round-robin agent assignment based on existing application count.
    const countRow = await systemDb.maybeOne<{ cnt: string }>(
      `select count(*)::text as cnt from loan_applications`,
    );
    const existingCount = countRow ? Number(countRow.cnt) : 0;
    const assignedAgent = selectLoanAgent(existingCount);

    const inserted = await systemDb.maybeOne<{ id: string }>(
      `insert into loan_applications(
        user_id, user_role,
        full_name, native_of, lga, state, residential_address, phone_1, phone_2,
        id_number, sex, date_of_birth, vehicle_reg_no, occupation, religion,
        worship_with, post_position, church_address,
        applicant_passport_url,
        surety1_title, surety1_full_name, surety1_family, surety1_native_of,
        surety1_lga, surety1_state, surety1_address, surety1_phone_1,
        surety1_phone_2, surety1_id_number, surety1_sex, surety1_date_of_birth,
        surety1_vehicle_reg_no, surety1_occupation, surety1_religion,
        surety1_worship_with, surety1_post_position, surety1_church_address,
        surety1_passport_url,
        surety2_title, surety2_full_name, surety2_family, surety2_native_of,
        surety2_lga, surety2_state, surety2_address, surety2_phone_1,
        surety2_phone_2, surety2_id_number, surety2_sex, surety2_date_of_birth,
        surety2_vehicle_reg_no, surety2_occupation, surety2_religion,
        surety2_worship_with, surety2_post_position, surety2_church_address,
        surety2_passport_url,
        loan_amount_figures, loan_amount_words, interest_rate_monthly,
        loan_type, duration_months, monthly_interest_amount,
        total_interest, total_repayable, agent_assigned, agent_name,
        repayment_frequency, date_received, creditor_name, terms_accepted, terms_accepted_at,
        account_name, account_number, bank_name
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44,
        $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58,
        $59, $60, $61, $62, $63, $64, $65, $66, $67, $68, $69, $70, $71, $72,
        $73, $74, $75
      ) returning id`,
      [
        user.id,
        userRole,
        // Borrower details
        String(form.get("full_name") ?? "").trim(),
        String(form.get("native_of") ?? "").trim(),
        String(form.get("lga") ?? "").trim(),
        String(form.get("state") ?? "").trim(),
        String(form.get("residential_address") ?? "").trim(),
        String(form.get("phone_1") ?? "").trim(),
        String(form.get("phone_2") ?? "").trim() || null,
        String(form.get("id_number") ?? "").trim(),
        String(form.get("sex") ?? ""),
        String(form.get("date_of_birth") ?? "") || null,
        String(form.get("vehicle_reg_no") ?? "").trim() || null,
        String(form.get("occupation") ?? "").trim(),
        String(form.get("religion") ?? "").trim(),
        String(form.get("worship_with") ?? "").trim(),
        String(form.get("post_position") ?? "").trim(),
        String(form.get("church_address") ?? "").trim(),
        // Applicant passport
        applicantPassportUrl,
        // Surety 1
        String(form.get("surety1_title") ?? "").trim(),
        String(form.get("surety1_full_name") ?? "").trim(),
        String(form.get("surety1_family") ?? "").trim(),
        String(form.get("surety1_native_of") ?? "").trim(),
        String(form.get("surety1_lga") ?? "").trim(),
        String(form.get("surety1_state") ?? "").trim(),
        String(form.get("surety1_address") ?? "").trim(),
        String(form.get("surety1_phone_1") ?? "").trim(),
        String(form.get("surety1_phone_2") ?? "").trim() || null,
        String(form.get("surety1_id_number") ?? "").trim(),
        String(form.get("surety1_sex") ?? ""),
        String(form.get("surety1_date_of_birth") ?? "") || null,
        String(form.get("surety1_vehicle_reg_no") ?? "").trim() || null,
        String(form.get("surety1_occupation") ?? "").trim(),
        String(form.get("surety1_religion") ?? "").trim(),
        String(form.get("surety1_worship_with") ?? "").trim(),
        String(form.get("surety1_post_position") ?? "").trim(),
        String(form.get("surety1_church_address") ?? "").trim(),
        // Surety 1 passport
        surety1PassportUrl,
        // Surety 2
        String(form.get("surety2_title") ?? "").trim(),
        String(form.get("surety2_full_name") ?? "").trim(),
        String(form.get("surety2_family") ?? "").trim(),
        String(form.get("surety2_native_of") ?? "").trim(),
        String(form.get("surety2_lga") ?? "").trim(),
        String(form.get("surety2_state") ?? "").trim(),
        String(form.get("surety2_address") ?? "").trim(),
        String(form.get("surety2_phone_1") ?? "").trim(),
        String(form.get("surety2_phone_2") ?? "").trim() || null,
        String(form.get("surety2_id_number") ?? "").trim(),
        String(form.get("surety2_sex") ?? ""),
        String(form.get("surety2_date_of_birth") ?? "") || null,
        String(form.get("surety2_vehicle_reg_no") ?? "").trim() || null,
        String(form.get("surety2_occupation") ?? "").trim(),
        String(form.get("surety2_religion") ?? "").trim(),
        String(form.get("surety2_worship_with") ?? "").trim(),
        String(form.get("surety2_post_position") ?? "").trim(),
        String(form.get("surety2_church_address") ?? "").trim(),
        // Surety 2 passport
        surety2PassportUrl,
        // Loan terms (calculated)
        loanAmountFigures,
        String(form.get("loan_amount_words") ?? "").trim(),
        interestRate,
        loanType,
        durationMonths,
        monthlyInterestAmount,
        totalInterest,
        totalRepayable,
        assignedAgent.email,
        assignedAgent.name,
        // Remaining terms
        String(form.get("repayment_frequency") ?? ""),
        String(form.get("date_received") ?? new Date().toISOString().slice(0, 10)),
        creditorName,
        termsAccepted,
        termsAccepted ? new Date().toISOString() : null,
        // Applicant bank account details (for disbursement)
        String(form.get("account_name") ?? "").trim() || null,
        String(form.get("account_number") ?? "").trim() || null,
        String(form.get("bank_name") ?? "").trim() || null,
      ],
    );

    if (!inserted) {
      return { error: "Could not submit loan application. Please try again." };
    }

    const reference = inserted.id;

    // --- Email notifications (non-fatal: application is already saved) -----
    const fullName =
      (String(form.get("full_name") ?? "").trim() || user.email?.split("@")[0]) ??
      "Applicant";
    const applicantEmail = String(user.email ?? "").trim();
    const applicantPhone = String(form.get("phone_1") ?? "").trim();
    const loanAmount = formatMoney(loanAmountFigures, "NGN");
    const repaymentFrequency = String(form.get("repayment_frequency") ?? "");
    const dateReceived = String(form.get("date_received") ?? new Date().toISOString().slice(0, 10));
    const surety1Name = String(form.get("surety1_full_name") ?? "").trim();
    const surety2Name = String(form.get("surety2_full_name") ?? "").trim();
    const loanLink = url("/loan");

    // 1. Confirmation email to the applicant.
    await sendEmail({
      to: applicantEmail,
      template: "loan_confirmation",
      dedupeKey: `loan-confirmation-${reference}`,
      data: {
        name: fullName,
        email: applicantEmail,
        subject: "Your loan application has been submitted",
        message: `Thank you for submitting your loan application. A loan officer will contact you shortly.`,
        applicationReference: reference,
        applicantName: fullName,
        loanAmount,
        interestRate: `${interestRate}%`,
        repaymentFrequency,
        dateReceived,
        loanType: loanType === "financial_lease" ? "Financial Lease" : "Pure Loan",
        durationMonths: String(durationMonths),
        monthlyInterest: formatMoney(monthlyInterestAmount, "NGN"),
        totalInterest: formatMoney(totalInterest, "NGN"),
        totalRepayable: formatMoney(totalRepayable, "NGN"),
        link: loanLink,
      },
    }).catch((err) => console.error("applicant loan email failed", err));

    // 2. Notification email to the system-selected loan agent.
    await sendEmail({
      to: assignedAgent.email,
      template: "loan_agent_notification",
      dedupeKey: `loan-agent-notification-${reference}`,
      data: {
        name: assignedAgent.name,
        email: assignedAgent.email,
        subject: `New loan application: ${fullName}`,
        message: `A new loan application from ${fullName} has been assigned to you for review.`,
        applicationReference: reference,
        applicantName: fullName,
        applicantEmail,
        applicantPhone,
        loanAmount,
        interestRate: `${interestRate}%`,
        repaymentFrequency,
        dateReceived,
        loanType: loanType === "financial_lease" ? "Financial Lease" : "Pure Loan",
        durationMonths: String(durationMonths),
        monthlyInterest: formatMoney(monthlyInterestAmount, "NGN"),
        totalInterest: formatMoney(totalInterest, "NGN"),
        totalRepayable: formatMoney(totalRepayable, "NGN"),
        surety1Name,
        surety2Name,
        agentName: assignedAgent.name,
        agentPhone: assignedAgent.phone,
        link: url("/admin"),
      },
      }).catch((err) => console.error("agent loan email failed", err));

    // 3. Notification email to all active super admins.
    try {
      const superAdmins = await systemDb.query<{ email: string }>(
        `select email from users where role = 'super_admin' and status = 'active'`,
      );
      for (const admin of superAdmins) {
        await sendEmail({
          to: admin.email,
          template: "admin_notification",
          dedupeKey: `loan-super-admin-${reference}-${admin.email}`,
          data: {
            name: "Administrator",
            email: admin.email,
            subject: `New loan application submitted: ${fullName}`,
            message: `A new ${loanType === "financial_lease" ? "Financial Lease" : "Pure Loan"} application for ${loanAmount} has been submitted by ${fullName} and assigned to loan officer ${assignedAgent.name}. Review it in the admin dashboard.`,
            link: url("/admin/loan-assessments"),
          },
        }).catch((err) => console.error("super admin loan email failed", err));
      }
    } catch (err) {
      console.error("super admin loan email lookup failed", err);
    }

    // 4. Notification email to additional addresses from LOAN_NOTIFICATION_EMAIL env var.
    // Comma-separated list, e.g. "owner@example.com,partner@example.com"
    const extraEmails = String(process.env.LOAN_NOTIFICATION_EMAIL ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    for (const email of extraEmails) {
      await sendEmail({
        to: email,
        template: "admin_notification",
        dedupeKey: `loan-notification-${reference}-${email}`,
        data: {
          name: "Administrator",
          email,
          subject: `New loan application submitted: ${fullName}`,
          message: `A new ${loanType === "financial_lease" ? "Financial Lease" : "Pure Loan"} application for ${loanAmount} has been submitted by ${fullName} and assigned to loan officer ${assignedAgent.name}. Review it in the admin dashboard.`,
          link: url("/admin/loan-assessments"),
        },
      }).catch((err) => console.error("loan notification email failed", err));
    }

    revalidatePath("/loan");
    return {
      message:
        "Your loan application has been submitted successfully. A confirmation email has been sent to you, and a loan officer will contact you shortly.",
      reference,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not submit loan application. Please try again.",
    };
  }
}
