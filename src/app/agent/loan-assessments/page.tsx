import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { getLoanAgentByEmail } from "@/lib/loan-agents";
import { redirect } from "next/navigation";
import { formatMoney, timeAgo } from "@/lib/utils";
import { Badge, PageHeader } from "@/components/ui";
import Link from "next/link";

export const metadata: Metadata = { title: "Assessments · Loan Officer" };

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
  created_at: string;
}

export default async function AgentAssessmentsPage() {
  const user = await requireUser();
  if (!getLoanAgentByEmail(user.email)) {
    redirect("/forbidden");
  }
  const agentEmail = user.email;

  const [pending, completed] = await Promise.all([
    systemDb.query<AssessmentRow>(
      `select l.id, l.full_name, u.email, l.phone_1, l.loan_amount_figures,
                l.loan_type, l.total_repayable, l.status,
                l.assessment_status, l.created_at
           from loan_applications l
           left join users u on u.id = l.user_id
          where l.agent_assigned = $1
            and l.assessment_status = 'pending'
          order by l.created_at asc`,
      [agentEmail],
    ),
    systemDb.query<AssessmentRow>(
      `select l.id, l.full_name, u.email, l.phone_1, l.loan_amount_figures,
                l.loan_type, l.total_repayable, l.status,
                l.assessment_status, l.created_at
           from loan_applications l
           left join users u on u.id = l.user_id
          where l.agent_assigned = $1
            and l.assessment_status <> 'pending'
          order by l.created_at desc`,
      [agentEmail],
    ),
  ]);

  return (
    <div className="space-y-4 ivh-animate-in">
      <div className="ivh-animate-in ivh-stagger-1">
        <PageHeader
          title="Loan Assessments"
          description={`Pending physical assessments assigned to you ({agentEmail}).`}
        />
        <p className="mt-1 text-xs text-ink-500">
          Signed in as <strong>{user.fullName}</strong> · {agentEmail}
        </p>
      </div>

      {/* Pending assessments — primary focus */}
      <div className="ivh-animate-in ivh-stagger-2">
        <h2 className="text-sm font-semibold text-ink-900 mb-3 flex items-center gap-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
          </span>
          Pending Assessment <span className="text-xs font-normal text-ink-400">({pending.length})</span>
        </h2>
        <div className="rounded-xl border border-ink-100 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[700px]">
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
                    Applied
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {pending.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-ink-500">
                      No pending assessments &mdash; you&#39;re caught up.
                    </td>
                  </tr>
                ) : (
                  pending.map((app) => (
                    <tr key={app.id} className="hover:bg-ink-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-medium text-ink-900">{app.full_name}</div>
                        <p className="text-xs text-ink-500">{app.email ?? "—"}</p>
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
                        <Badge tone="neutral">{app.status.replace(/_/g, " ")}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-xs text-ink-500">{timeAgo(app.created_at)}</p>
                      </td>
                      <td className="px-5 py-3">
                        <Link
                          href={`/agent/loan-assessments/${app.id}`}
                          className="btn-primary btn-sm"
                        >
                          Assess
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Completed assessments */}
      {completed.length > 0 && (
        <div className="ivh-animate-in ivh-stagger-3">
          <h2 className="text-sm font-semibold text-ink-900 mb-3">
            Completed <span className="text-xs font-normal text-ink-400">({completed.length})</span>
          </h2>
          <div className="rounded-xl border border-ink-100 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[700px]">
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
                      Decision
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">
                      Assessment
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {completed.map((app) => (
                    <tr key={app.id} className="hover:bg-ink-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-medium text-ink-900">{app.full_name}</div>
                        <p className="text-xs text-ink-500">{app.email ?? "—"}</p>
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
                        <Badge tone={app.status === "approved" ? "success" : app.status === "rejected" ? "danger" : "neutral"}>
                          {app.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone="success">
                          {app.assessment_status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <Link
                          href={`/agent/loan-assessments/${app.id}`}
                          className="btn-secondary btn-sm"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
