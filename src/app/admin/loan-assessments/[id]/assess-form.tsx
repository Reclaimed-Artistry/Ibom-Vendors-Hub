"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { submitLoanAssessmentAction } from "@/app/actions/loan-assessments";
import { Alert } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmSubmit } from "@/components/confirm-button";

interface LoanApplicationRow {
  id: string;
  full_name: string;
  email: string | null;
  phone_1: string | null;
  phone_2: string | null;
  native_of: string;
  lga: string;
  state: string;
  residential_address: string;
  id_number: string;
  sex: string;
  date_of_birth: string | null;
  vehicle_reg_no: string | null;
  occupation: string;
  religion: string;
  worship_with: string;
  post_position: string;
  church_address: string;
  applicant_passport_url: string | null;
  loan_amount_figures: number;
  loan_amount_words: string;
  interest_rate_monthly: number;
  loan_type: string;
  duration_months: number;
  monthly_interest_amount: number;
  total_interest: number;
  total_repayable: number;
  repayment_frequency: string;
  date_received: string | null;
  creditor_name: string;
  agent_assigned: string | null;
  agent_name: string | null;
  status: string;
  created_at: string;
  // Surety 1
  surety1_title: string;
  surety1_full_name: string;
  surety1_family: string;
  surety1_native_of: string;
  surety1_lga: string;
  surety1_state: string;
  surety1_address: string;
  surety1_phone_1: string | null;
  surety1_phone_2: string | null;
  surety1_id_number: string;
  surety1_sex: string;
  surety1_date_of_birth: string | null;
  surety1_vehicle_reg_no: string | null;
  surety1_occupation: string;
  surety1_religion: string;
  surety1_worship_with: string;
  surety1_post_position: string;
  surety1_church_address: string;
  surety1_passport_url: string | null;
  // Surety 2
  surety2_title: string;
  surety2_full_name: string;
  surety2_family: string;
  surety2_native_of: string;
  surety2_lga: string;
  surety2_state: string;
  surety2_address: string;
  surety2_phone_1: string | null;
  surety2_phone_2: string | null;
  surety2_id_number: string;
  surety2_sex: string;
  surety2_date_of_birth: string | null;
  surety2_vehicle_reg_no: string | null;
  surety2_occupation: string;
  surety2_religion: string;
  surety2_worship_with: string;
  surety2_post_position: string;
  surety2_church_address: string;
  surety2_passport_url: string | null;
  // Account details
  account_name: string | null;
  account_number: string | null;
  bank_name: string | null;
}

export function LoanAssessmentForm({ app }: { app: LoanApplicationRow }) {
  const [state, formAction] = useActionState(
    submitLoanAssessmentAction,
    {} as { error?: string; message?: string },
  );
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const [approvedAmountInput, setApprovedAmountInput] = useState("");
  const [approvedAmountPreview, setApprovedAmountPreview] = useState<{
    monthlyInterest: number;
    totalInterest: number;
    totalRepayable: number;
    monthlyPayment: number;
    planType: string;
  } | null>(null);

  const MONTHLY_INTEREST_RATE = 10;

  function buildPreview(
    loanType: string,
    amount: number,
    duration: number,
  ): {
    monthlyInterest: number;
    totalInterest: number;
    totalRepayable: number;
    monthlyPayment: number;
    planType: string;
  } {
    const monthlyInterest = Math.round((amount * (MONTHLY_INTEREST_RATE / 100)) * 100) / 100;
    const totalInterest = Math.round((monthlyInterest * duration) * 100) / 100;
    const totalRepayable = Math.round(((amount + totalInterest) * 100)) / 100;

    let monthlyPayment: number;
    let planType: string;

    if (loanType === "financial_lease") {
      planType = "financial_lease";
      monthlyPayment = monthlyInterest; // interest-only during term
    } else {
      planType = "pure_loan";
      monthlyPayment = Math.round((totalRepayable / duration) * 100) / 100;
    }

    return { monthlyInterest, totalInterest, totalRepayable, monthlyPayment, planType };
  }

  // Recalculate preview when decision or approved amount changes
  const prevDecisionRef = useRef(decision);
  useEffect(() => {
    if (decision !== "approve") {
      setApprovedAmountPreview(null);
      return;
    }
    const amount = Number(approvedAmountInput) || app.loan_amount_figures;
    setApprovedAmountPreview(buildPreview(app.loan_type, amount, app.duration_months));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decision, approvedAmountInput]);

  return (
    <div className="container-page py-10 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold tracking-tight text-ink-900 sm:text-2xl mb-1">
        Assess Loan Application
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-500">
        Physical assessment for <strong>{app.full_name}</strong> —{" "}
        {new Intl.NumberFormat("en-NG", {
          style: "currency",
          currency: "NGN",
        }).format(app.loan_amount_figures)}
      </p>

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <form action={formAction} className="space-y-6 mt-6">
        <input type="hidden" name="application_id" value={app.id} />

        {/* Applicant details card */}
        <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-brand-800 uppercase tracking-wider mb-4">
            Applicant details (submitted form)
          </h2>

          {/* Passport photo */}
          {app.applicant_passport_url && (
            <div className="mb-4">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-2">
                Applicant Passport Photograph
              </p>
              <img
                src={app.applicant_passport_url}
                alt="Applicant passport"
                className="max-w-xs h-auto rounded-lg border border-ink-200"
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Full name
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.full_name}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Phone Number (1)
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.phone_1 ?? "—"}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Phone Number (2)
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.phone_2 ?? "—"}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Email
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.email ?? "—"}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Native of (Town)
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.native_of}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                L.G.A.
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.lga}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                State
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.state}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Residential Address
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.residential_address}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                ID Number
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.id_number}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Sex
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.sex}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Date of Birth
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.date_of_birth ?? "—"}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Vehicle Registration No.
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.vehicle_reg_no ?? "—"}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Occupation / Post
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.occupation}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Religion
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.religion}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Worship With
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.worship_with}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Post / Position
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.post_position}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Church Address
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.church_address}
              </p>
            </div>
          </div>
        </div>

        {/* Bank account details card */}
        <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-brand-800 uppercase tracking-wider mb-4">
            Bank Account Details (for disbursement)
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Bank Name
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.bank_name ?? "—"}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Account Name
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.account_name ?? "—"}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Account Number
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.account_number ?? "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Loan terms card */}
        <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-brand-800 uppercase tracking-wider mb-4">
            Loan Terms
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Loan Amount (Figures)
              </p>
              <p className="text-sm font-medium text-ink-900">
                {new Intl.NumberFormat("en-NG", {
                  style: "currency",
                  currency: "NGN",
                }).format(app.loan_amount_figures)}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Loan Amount (Words)
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.loan_amount_words}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Loan Type
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.loan_type.replace("_", " ")}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Duration (months)
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.duration_months} month(s)
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Interest Rate (per month)
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.interest_rate_monthly}%
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Monthly Interest Amount
              </p>
              <p className="text-sm font-medium text-ink-900">
                {new Intl.NumberFormat("en-NG", {
                  style: "currency",
                  currency: "NGN",
                }).format(app.monthly_interest_amount)}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Total Interest
              </p>
              <p className="text-sm font-medium text-ink-900">
                {new Intl.NumberFormat("en-NG", {
                  style: "currency",
                  currency: "NGN",
                }).format(app.total_interest)}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Total Repayable
              </p>
              <p className="text-sm font-medium text-brand-700">
                {new Intl.NumberFormat("en-NG", {
                  style: "currency",
                  currency: "NGN",
                }).format(app.total_repayable)}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Repayment Frequency
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.repayment_frequency}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Date Received
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.date_received ?? "—"}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Creditor / Lender Name
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.creditor_name}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Assigned Agent
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.agent_name ?? "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Surety 1 card */}
        <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-brand-800 uppercase tracking-wider">
              First Surety (Guarantor)
            </h2>
            {app.surety1_passport_url && (
              <img
                src={app.surety1_passport_url}
                alt="Surety 1 passport"
                className="max-w-[120px] h-auto rounded-lg border border-ink-200"
              />
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Title
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety1_title}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Full Name
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety1_full_name}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Family Name
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety1_family}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Native of (Town)
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety1_native_of}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                L.G.A.
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety1_lga}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                State
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety1_state}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Residential Address
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety1_address}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Phone Number (1)
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety1_phone_1 ?? "—"}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Phone Number (2)
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety1_phone_2 ?? "—"}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                ID Number
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety1_id_number}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Sex
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety1_sex}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Date of Birth
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety1_date_of_birth ?? "—"}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Vehicle Registration No.
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety1_vehicle_reg_no ?? "—"}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Occupation / Post
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety1_occupation}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Religion
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety1_religion}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Worship With
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety1_worship_with}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Post / Position
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety1_post_position}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Church Address
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety1_church_address}
              </p>
            </div>
          </div>
        </div>

        {/* Surety 2 card */}
        <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-brand-800 uppercase tracking-wider">
              Second Surety (Guarantor)
            </h2>
            {app.surety2_passport_url && (
              <img
                src={app.surety2_passport_url}
                alt="Surety 2 passport"
                className="max-w-[120px] h-auto rounded-lg border border-ink-200"
              />
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Title
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety2_title}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Full Name
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety2_full_name}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Family Name
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety2_family}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Native of (Town)
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety2_native_of}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                L.G.A.
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety2_lga}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                State
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety2_state}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Residential Address
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety2_address}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Phone Number (1)
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety2_phone_1 ?? "—"}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Phone Number (2)
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety2_phone_2 ?? "—"}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                ID Number
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety2_id_number}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Sex
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety2_sex}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Date of Birth
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety2_date_of_birth ?? "—"}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Vehicle Registration No.
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety2_vehicle_reg_no ?? "—"}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Occupation / Post
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety2_occupation}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Religion
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety2_religion}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Worship With
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety2_worship_with}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Post / Position
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety2_post_position}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Church Address
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety2_church_address}
              </p>
            </div>
          </div>
        </div>

        {/* Assessment parameters */}
        <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-brand-800 uppercase tracking-wider mb-4">
            Physical assessment — tick what you observed
          </h2>
          <p className="text-sm text-ink-500 mb-4">
            Visit the applicant at their stated address and confirm each item
            below before making a decision.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 p-3 border rounded-lg bg-ink-50/50 cursor-pointer hover:bg-ink-100 transition-colors">
              <input
                name="proof_of_residence"
                type="checkbox"
                className="size-4 text-brand-600"
              />
              <span className="text-sm text-ink-900">Proof of residence</span>
            </label>
            <label className="flex items-center gap-2 p-3 border rounded-lg bg-ink-50/50 cursor-pointer hover:bg-ink-100 transition-colors">
              <input
                name="proof_of_business_ownership"
                type="checkbox"
                className="size-4 text-brand-600"
              />
              <span className="text-sm text-ink-900">
                Proof of business ownership
              </span>
            </label>
            <label className="flex items-center gap-2 p-3 border rounded-lg bg-ink-50/50 cursor-pointer hover:bg-ink-100 transition-colors">
              <input
                name="collateral"
                type="checkbox"
                className="size-4 text-brand-600"
              />
              <span className="text-sm text-ink-900">Collateral inspected</span>
            </label>
            <label className="flex items-center gap-2 p-3 border rounded-lg bg-ink-50/50 cursor-pointer hover:bg-ink-100 transition-colors">
              <input
                name="applicant_identity"
                type="checkbox"
                className="size-4 text-brand-600"
              />
              <span className="text-sm text-ink-900">
                Applicant identity verified
              </span>
            </label>
            <label className="flex items-center gap-2 p-3 border rounded-lg bg-ink-50/50 cursor-pointer hover:bg-ink-100 transition-colors">
              <input
                name="surety_contacts"
                type="checkbox"
                className="size-4 text-brand-600"
              />
              <span className="text-sm text-ink-900">Surety contacts verified</span>
            </label>
            <label className="flex items-center gap-2 p-3 border rounded-lg bg-ink-50/50 cursor-pointer hover:bg-ink-100 transition-colors">
              <input
                name="business_premises_visited"
                type="checkbox"
                className="size-4 text-brand-600"
              />
              <span className="text-sm text-ink-900">
                Business premises visited
              </span>
            </label>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label mb-1">Collateral type (optional)</label>
              <input
                name="collateral_type"
                className="input"
                placeholder="e.g. Vehicle, Land, Equipment"
              />
            </div>
            <div>
              <label className="label mb-1">Collateral estimated value (optional)</label>
              <input
                name="collateral_value"
                className="input"
                placeholder="e.g. ₦500,000"
              />
            </div>
          </div>
        </div>

        {/* Decision */}
        <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-brand-800 uppercase tracking-wider mb-4">
            Decision
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 p-4 border rounded-lg cursor-pointer transition-colors">
              <input
                name="decision"
                type="radio"
                value="approve"
                className="size-4 text-brand-600"
                defaultChecked={decision === "approve"}
                onChange={() => setDecision("approve")}
              />
              <div>
                <p className="text-sm font-semibold text-ink-900">
                  Approve loan
                </p>
                <p className="text-xs text-ink-500">
                  Applicant meets assessment criteria
                </p>
              </div>
            </label>
            <label className="flex items-center gap-2 p-4 border rounded-lg cursor-pointer transition-colors">
              <input
                name="decision"
                type="radio"
                value="reject"
                className="size-4 text-red-600"
                defaultChecked={decision === "reject"}
                onChange={() => setDecision("reject")}
              />
              <div>
                <p className="text-sm font-semibold text-ink-900">
                  Reject loan
                </p>
                <p className="text-xs text-ink-500">
                  Applicant does not meet criteria
                </p>
              </div>
            </label>
          </div>

          {/* Approved amount — required when approving */}
          {decision === "approve" && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="label mb-1">
                  Approved amount (₦)
                </label>
                <input
                  name="approved_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  className="input"
                  placeholder={new Intl.NumberFormat("en-NG", {
                    style: "currency",
                    currency: "NGN",
                  }).format(app.loan_amount_figures)}
                  defaultValue={String(app.loan_amount_figures)}
                  onChange={(e) => setApprovedAmountInput(e.target.value)}
                  value={approvedAmountInput || String(app.loan_amount_figures)}
                />
                <p className="text-xs text-ink-500 mt-1">
                  Cannot exceed applied amount of{" "}
                  <span className="font-medium text-ink-900">
                    {new Intl.NumberFormat("en-NG", {
                      style: "currency",
                      currency: "NGN",
                    }).format(app.loan_amount_figures)}
                  </span>
                </p>
              </div>
              {decision === "approve" && approvedAmountPreview && (
                <div className="col-span-2 bg-brand-50/50 p-3 rounded-lg">
                  <p className="text-xs text-ink-400 uppercase tracking-wider mb-2">
                    Recalculated terms (10% / month on approved amount)
                  </p>
                  <div className="grid gap-2 sm:grid-cols-4 text-sm">
                    <div>
                      <p className="text-xs text-ink-400 uppercase tracking-wider">
                        Monthly interest
                      </p>
                      <p className="font-medium text-ink-900">
                        {new Intl.NumberFormat("en-NG", {
                          style: "currency",
                          currency: "NGN",
                        }).format(approvedAmountPreview.monthlyInterest)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-400 uppercase tracking-wider">
                        Total interest
                      </p>
                      <p className="font-medium text-ink-900">
                        {new Intl.NumberFormat("en-NG", {
                          style: "currency",
                          currency: "NGN",
                        }).format(approvedAmountPreview.totalInterest)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-400 uppercase tracking-wider">
                        Total repayable
                      </p>
                      <p className="font-medium text-brand-700">
                        {new Intl.NumberFormat("en-NG", {
                          style: "currency",
                          currency: "NGN",
                        }).format(approvedAmountPreview.totalRepayable)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-400 uppercase tracking-wider">
                        Monthly payment
                      </p>
                      <p className="font-medium text-ink-900">
                        {new Intl.NumberFormat("en-NG", {
                          style: "currency",
                          currency: "NGN",
                        }).format(approvedAmountPreview.monthlyPayment)}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-ink-500 mt-2">
                    Plan:{" "}
                    <span className="font-medium text-ink-900">
                      {approvedAmountPreview.planType.replace("_", " ")}
                    </span>{" "}
                    over {app.duration_months} month{
                      app.duration_months === 1 ? "" : "s"
                    }
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notes and visit date */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="col-span-2">
            <label className="label mb-1">Assessment notes</label>
            <textarea
              name="assessment_notes"
              className="textarea"
              rows={3}
              placeholder="Record your observations from the physical visit…"
            />
          </div>
          <div>
            <label className="label mb-1">Date of physical visit</label>
            <input
              name="physical_visit_date"
              type="date"
              className="input"
            />
          </div>
        </div>

        <div className="pt-6 border-t border-ink-100 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-500">
            Once submitted, the applicant will be notified by email.
          </p>
          <div className="flex items-center gap-2">
            <ConfirmSubmit
              message="Are you sure you want to record this assessment? The applicant will be notified of the decision."
              className="btn-primary btn-sm"
              name="confirm"
              value="1"
            >
              Submit assessment
            </ConfirmSubmit>
          </div>
        </div>
      </form>

      <div className="mt-6 flex gap-3">
        <Link href="/admin/loan-assessments" className="btn-secondary">
          Back to assessments
        </Link>
      </div>
    </div>
  );
}
