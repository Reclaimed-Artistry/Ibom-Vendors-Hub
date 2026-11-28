"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { submitLoanAssessmentAction, type AssessmentState } from "@/app/actions/loan-assessments";
import { Alert } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { ConfirmSubmit } from "@/components/confirm-button";

interface LoanAppRow {
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
  assessment_status: string;
  surety1_full_name: string;
  surety2_full_name: string;
  created_at: string;
}

interface AgentLoanAssessFormProps {
  app: LoanAppRow;
}

export function AgentLoanAssessForm({ app }: AgentLoanAssessFormProps) {
  const [state, formAction] = useActionState(
    async (prev: AssessmentState | null, form: FormData) => {
      return submitLoanAssessmentAction(prev as AssessmentState, form);
    },
    null,
  );

  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [approvedAmountInput, setApprovedAmountInput] = useState("");
  const prevDecisionRef = useRef(decision);

  useEffect(() => {
    if (decision !== prevDecisionRef.current) {
      prevDecisionRef.current = decision;
      if (decision !== "approve") {
        setApprovedAmountInput("");
      }
    }
  }, [decision]);

  return (
    <div className="container-page py-10 max-w-5xl mx-auto ivh-animate-in">
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

      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.message ? <Alert tone="success">{state.message}</Alert> : null}

      <form action={formAction} className="space-y-6 mt-6">
        <input type="hidden" name="application_id" value={app.id} />

        {/* Applicant details card */}
        <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-brand-800 uppercase tracking-wider mb-4">
            Applicant details (submitted form)
          </h2>

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
              <p className="text-sm font-medium text-ink-900">{app.lga}</p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                State
              </p>
              <p className="text-sm font-medium text-ink-900">{app.state}</p>
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
              <p className="text-sm font-medium text-ink-900">{app.id_number}</p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Sex
              </p>
              <p className="text-sm font-medium text-ink-900">{app.sex}</p>
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
                Occupation / Post
              </p>
              <p className="text-sm font-medium text-ink-900">{app.occupation}</p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Religion
              </p>
              <p className="text-sm font-medium text-ink-900">{app.religion}</p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Surety 1
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety1_full_name}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Surety 2
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.surety2_full_name}
              </p>
            </div>
          </div>
        </div>

        {/* Loan summary card */}
        <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-brand-800 uppercase tracking-wider mb-4">
            Loan summary
          </h2>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Applied amount
              </p>
              <p className="text-sm font-medium text-ink-900">
                {formatMoney(app.loan_amount_figures)}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Total repayable
              </p>
              <p className="text-sm font-medium text-ink-900">
                {formatMoney(app.total_repayable)}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Duration
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.duration_months} month{app.duration_months === 1 ? "" : "s"}
              </p>
            </div>
            <div className="bg-ink-50 p-3 rounded-lg">
              <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">
                Loan type
              </p>
              <p className="text-sm font-medium text-ink-900">
                {app.loan_type.replace("_", " ")}
              </p>
            </div>
          </div>
        </div>

        {/* Assessment form */}
        <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-brand-800 uppercase tracking-wider mb-4">
            Assessment decision
          </h2>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-ink-400 uppercase tracking-wider">
                Decision
              </label>
              <div className="grid gap-2">
                <label className="cursor-pointer item">
                  <input
                    type="radio"
                    name="decision"
                    value="approve"
                    checked={decision === "approve"}
                    onChange={() => setDecision("approve")}
                    className="form-radio"
                  />
                  <span className="text-sm font-medium text-ink-900">Approve</span>
                </label>
                <label className="cursor-pointer item">
                  <input
                    type="radio"
                    name="decision"
                    value="reject"
                    checked={decision === "reject"}
                    onChange={() => setDecision("reject")}
                    className="form-radio"
                  />
                  <span className="text-sm font-medium text-ink-900">Reject</span>
                </label>
              </div>
            </div>
            {decision === "approve" && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-ink-400 uppercase tracking-wider">
                  Approved amount (₦)
                </label>
                <input
                  name="approved_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={app.loan_amount_figures}
                  value={decision === "approve" ? approvedAmountInput : undefined}
                  onChange={(e) => setApprovedAmountInput(e.target.value)}
                  className="input"
                  placeholder="0.00"
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-ink-400 uppercase tracking-wider">
                Physical visit date
              </label>
              <input
                name="physical_visit_date"
                type="date"
                className="input"
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-ink-400 uppercase tracking-wider">
              Assessment notes
            </label>
            <textarea
              name="assessment_notes"
              rows={4}
              className="input"
              placeholder="Record your physical assessment findings..."
            />
          </div>

          <div className="flex items-center gap-4 pt-4">
            <ConfirmSubmit
              className={`btn btn-danger btn-sm ${!decision || (decision === "approve" && !approvedAmountInput) ? "opacity-50 pointer-events-none" : ""}`}
              message="Once submitted, this decision cannot be changed. Are you sure?"
            >
              Submit assessment
            </ConfirmSubmit>
            <p className="text-xs text-ink-400">
              Once submitted, this decision cannot be changed.
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Link href="/agent/loan-assessments" className="btn-secondary">
            Back to assessments
          </Link>
        </div>
      </form>
    </div>
  );
}
