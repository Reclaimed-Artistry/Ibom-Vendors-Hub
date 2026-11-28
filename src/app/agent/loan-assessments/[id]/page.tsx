import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { getLoanAgentByEmail } from "@/lib/loan-agents";
import { redirect } from "next/navigation";
import { Alert, PageHeader } from "@/components/ui";
import Link from "next/link";
import { AgentLoanAssessForm } from "./assess-form";

export const metadata: Metadata = { title: "Assess Loan · Loan Officer" };

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
  assessed_by: string | null;
  assessed_at: string | null;
  agent_decision: string | null;
  agent_decision_notes: string | null;
  money_sent: boolean;
  loan_paid_off: boolean;
  surety1_full_name: string;
  surety1_phone_1: string | null;
  surety2_full_name: string;
  surety2_phone_1: string | null;
  account_name: string | null;
  account_number: string | null;
  bank_name: string | null;
  created_at: string;
}

export default async function AgentLoanAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!getLoanAgentByEmail(user.email)) {
    redirect("/forbidden");
  }
  const agentEmail = user.email;
  const { id } = await params;

  const app = await systemDb.maybeOne<LoanAppRow>(
    `select l.*, u.email
       from loan_applications l
       left join users u on u.id = l.user_id
      where l.id = $1`,
    [id],
  );

  if (!app) {
    return (
      <div className="container-page py-10 max-w-md mx-auto ivh-animate-in">
        <Alert tone="danger">
          <p className="font-semibold">Loan application not found.</p>
        </Alert>
        <Link
          href="/agent/loan-assessments"
          className="btn-secondary mt-4 inline-block"
        >
          Back to assessments
        </Link>
      </div>
    );
  }

  // Only the assigned agent can assess this loan.
  if (app.agent_assigned !== agentEmail) {
    redirect("/forbidden");
  }

  if (app.assessment_status === "completed") {
    return (
      <div className="container-page py-10 max-w-3xl mx-auto ivh-animate-in">
        <PageHeader
          title="Assessment already completed"
          description="This loan application has already been assessed."
        />
        <Alert tone="info">
          <p>
            Decision:{" "}
            <strong>{app.agent_decision}</strong>. Assessed{" "}
            {app.assessed_at
              ? new Date(app.assessed_at).toLocaleDateString()
              : "on record"} by{" "}
            {app.agent_decision_notes ? app.agent_decision_notes : "a loan officer"}.
          </p>
          {app.agent_decision_notes && (
            <p className="mt-2 text-sm text-ink-500">
              Notes: {app.agent_decision_notes}
            </p>
          )}
        </Alert>
        <div className="mt-6 flex gap-3">
          <Link href="/agent/loan-assessments" className="btn-secondary">
            Back to assessments
          </Link>
        </div>
      </div>
    );
  }

  return <AgentLoanAssessForm app={app} />;
}
