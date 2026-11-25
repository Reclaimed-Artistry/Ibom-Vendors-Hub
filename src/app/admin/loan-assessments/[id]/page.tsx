import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { getLoanAgentByEmail } from "@/lib/loan-agents";
import { redirect } from "next/navigation";
import { formatMoney, formatDate } from "@/lib/utils";
import { Alert, PageHeader } from "@/components/ui";
import { LoanAssessmentForm } from "./assess-form";
import { DisbursementActions } from "./disbursement-actions";

export const metadata: Metadata = { title: "Assess Loan · Admin" };

interface LoanApplicationRow {
  id: string;
  user_id: string;
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

export default async function LoanAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin();
  if (user.role !== "super_admin" && !getLoanAgentByEmail(user.email)) {
    redirect("/forbidden");
  }
  const { id } = await params;

    const app = await systemDb.maybeOne<LoanApplicationRow>(
    `select l.*, u.email, l.money_sent, l.loan_paid_off
       from loan_applications l
       left join users u on u.id = l.user_id
      where l.id = $1`,
    [id],
  );

  if (!app) {
    return notFoundUI();
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
            Decision:{ " " }
            <strong>{app.agent_decision}</strong>. Assessed{" "}
            {app.assessed_at ? formatDate(app.assessed_at) : "on record"} by{" "}
            {app.assessed_by ?? "a loan officer"}.
          </p>
          {app.agent_decision_notes && (
            <p className="mt-2 text-sm text-ink-500">
              Notes: {app.agent_decision_notes}
            </p>
          )}
        </Alert>
        <DisbursementActions
          applicationId={app.id}
          status={app.status}
          moneySent={app.money_sent}
          loanPaidOff={app.loan_paid_off}
        />
        <div className="mt-6 flex gap-3">
          <Link href="/admin/loan-assessments" className="btn-secondary">
            Back to assessments
          </Link>
        </div>
      </div>
    );
  }

  return <LoanAssessmentForm app={app} />;
}

function notFoundUI() {
  return (
    <div className="container-page py-10 max-w-md mx-auto ivh-animate-in">
      <Alert tone="danger">
        <p className="font-semibold">Loan application not found.</p>
      </Alert>
      <Link
        href="/admin/loan-assessments"
        className="btn-secondary mt-4 inline-block"
      >
        Back to assessments
      </Link>
    </div>
  );
}
