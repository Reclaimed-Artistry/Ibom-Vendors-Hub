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
  approved_amount: number | null;
  approved_monthly_interest: number | null;
  approved_total_interest: number | null;
  approved_total_repayable: number | null;
  approved_monthly_payment: number | null;
  repayment_plan_type: string | null;
  repayment_schedule: string | null;
  agent_approved_at: string | null;
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
          {app.agent_decision === "approve" && app.approved_amount && (
            <div className="mt-4 rounded-lg bg-brand-50/50 p-4 border border-brand-200/50">
              <p className="text-xs font-semibold text-brand-800 uppercase tracking-wider mb-2">
                Approved loan terms
              </p>
              <div className="grid gap-2 sm:grid-cols-4 text-sm">
                <div>
                  <p className="text-xs text-ink-400 uppercase tracking-wider">
                    Approved amount
                  </p>
                  <p className="font-medium text-ink-900">
                    {new Intl.NumberFormat("en-NG", {
                      style: "currency",
                      currency: "NGN",
                    }).format(app.approved_amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink-400 uppercase tracking-wider">
                    Monthly interest (10%)
                  </p>
                  <p className="font-medium text-ink-900">
                    {new Intl.NumberFormat("en-NG", {
                      style: "currency",
                      currency: "NGN",
                    }).format(app.approved_monthly_interest ?? 0)}
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
                    }).format(app.approved_total_interest ?? 0)}
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
                    }).format(app.approved_total_repayable ?? 0)}
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
                    }).format(app.approved_monthly_payment ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink-400 uppercase tracking-wider">
                    Repayment plan
                  </p>
                  <p className="font-medium text-ink-900">
                    {(app.repayment_plan_type ?? "pure_loan").replace(
                      "_",
                      " ",
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink-400 uppercase tracking-wider">
                    Duration
                  </p>
                  <p className="font-medium text-ink-900">
                    {app.duration_months} month{app.duration_months === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              {app.repayment_schedule && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-ink-600 mb-1">
                    Repayment schedule
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead>
                        <tr className="border-b border-brand-200">
                          <th className="px-2 py-1 text-xs text-brand-600 font-semibold">
                            #
                          </th>
                          <th className="px-2 py-1 text-xs text-brand-600 font-semibold">
                            Due (month)
                          </th>
                          <th className="px-2 py-1 text-xs text-brand-600 font-semibold text-right">
                            Amount (₦)
                          </th>
                          <th className="px-2 py-1 text-xs text-brand-600 font-semibold">
                            Description
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(JSON.parse(app.repayment_schedule) as Array<{
                          installment: number;
                          due_offset_months: number;
                          amount: number;
                          description: string;
                        }>).map((item) => (
                          <tr key={item.installment} className="border-b border-brand-100/50">
                            <td className="px-2 py-1 text-xs text-ink-600">
                              {item.installment}
                            </td>
                            <td className="px-2 py-1 text-xs text-ink-600">
                              Month {item.due_offset_months}
                            </td>
                            <td className="px-2 py-1 text-xs text-ink-900 font-medium text-right">
                              {new Intl.NumberFormat("en-NG", {
                                style: "currency",
                                currency: "NGN",
                              }).format(item.amount)}
                            </td>
                            <td className="px-2 py-1 text-xs text-ink-500">
                              {item.description}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
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
