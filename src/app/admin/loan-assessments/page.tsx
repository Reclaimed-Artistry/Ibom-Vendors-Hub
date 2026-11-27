import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { formatMoney, timeAgo } from "@/lib/utils";
import { Badge, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Loan Assessments · Admin" };

interface AssessmentRow {
  id: string;
  full_name: string;
  email: string | null;
  phone_1: string | null;
  loan_amount_figures: number;
  loan_type: string;
  total_repayable: number;
  status: string;
  assessment_status: string;
  agent_assigned: string | null;
  agent_name: string | null;
  created_at: string;
}

export default async function LoanAssessmentsPage() {
  const user = await requireAdmin();

  const applications = await systemDb.query<AssessmentRow>(
    `select l.id, l.full_name, u.email, l.phone_1, l.loan_amount_figures,
            l.loan_type, l.total_repayable, l.status,
            l.assessment_status, l.agent_assigned, l.agent_name,
            l.created_at
           from loan_applications l
           left join users u on u.id = l.user_id
          order by
            case when l.assessment_status = 'pending' then 0 else 1 end,
            l.created_at desc`,
  );

  const pendingCount = applications.filter(
    (a) => a.assessment_status === "pending",
  ).length;

  return (
    <div className="space-y-4 ivh-animate-in">
      <PageHeader
        title="Loan Assessments"
        description={
          pendingCount > 0
            ? `${pendingCount} application${pendingCount === 1 ? "" : "s"} awaiting your assessment.`
            : "All loan applications have been assessed."
        }
      />

      <div className="rounded-xl border border-ink-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[600px]">
            <thead>
              <tr className="bg-ink-50 border-b border-ink-100">
                <th className="px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">
                  Applicant
                </th>
                <th className="px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">
                  Loan
                </th>
                <th className="px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">
                  Repayable
                </th>
                <th className="px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">
                  Assessment
                </th>
                <th className="px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">
                  Assigned agent
                </th>
                <th className="px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-ink-500">
                    No loan applications yet.
                  </td>
                </tr>
              ) : (
                applications.map((app) => {
                  const isPending = app.assessment_status === "pending";
                  return (
                    <tr
                      key={app.id}
                      className="hover:bg-ink-50 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <div className="font-medium text-ink-900">
                          {app.full_name}
                        </div>
                        <p className="text-xs text-ink-500">
                          {app.email ?? "—"}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-ink-900">
                          {formatMoney(app.loan_amount_figures)}
                        </p>
                        <p className="text-xs text-ink-500">
                          {app.loan_type.replace("_", " ")}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-ink-900">
                          {formatMoney(app.total_repayable)}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <Badge
                          tone={
                            app.status === "repaid"
                              ? "success"
                              : app.status === "disbursed"
                                ? "info"
                                : app.status === "approved"
                                  ? "warning"
                                  : app.status === "rejected"
                                    ? "danger"
                                    : "neutral"
                      }
                      >
                        {app.status.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge
                        tone={isPending ? "warning" : "success"}
                      >
                        {app.assessment_status.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-xs text-ink-500">
                        {app.agent_assigned ?? "—"}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      {isPending ? (
                        <Link
                          href={`/admin/loan-assessments/${app.id}`}
                          className="btn-primary btn-sm"
                        >
                          Assess
                        </Link>
                      ) : (
                        <Link
                          href={`/admin/loan-assessments/${app.id}`}
                          className="btn-secondary btn-sm"
                        >
                          View
                        </Link>
                      )}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
