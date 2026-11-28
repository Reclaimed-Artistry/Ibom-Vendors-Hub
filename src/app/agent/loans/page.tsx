import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { getLoanAgentByEmail } from "@/lib/loan-agents";
import { redirect } from "next/navigation";
import { formatMoney, timeAgo } from "@/lib/utils";
import { Badge, Alert, PageHeader, StatCard } from "@/components/ui";
import { AlertCircle, Clock, CreditCard, RefreshCw, Users, Wallet } from "lucide-react";

export const metadata: Metadata = { title: "My Loans · Loan Officer" };

interface LoanStats {
  total_applications: number;
  pending_assessment: number;
  approved: number;
  disbursed: number;
  repaid: number;
  rejected: number;
  defaulted: number;
  overdue: number;
  total_amount_lent: number;
  total_amount_repaid: number;
  outstanding_balance: number;
}

interface LoanRow {
  id: string;
  full_name: string;
  email: string | null;
  phone_1: string | null;
  loan_amount_figures: number;
  loan_type: string;
  total_repayable: number;
  amount_paid: number;
  status: string;
  assessment_status: string;
  agent_decision: string | null;
  agent_name: string | null;
  money_sent: boolean;
  loan_paid_off: boolean;
  next_payment_due: string | null;
  repayment_frequency: string;
  duration_months: number;
  created_at: string;
  agent_assigned: string | null;
}

export default async function AgentLoansPage() {
  const user = await requireUser(["admin"]);
  if (!getLoanAgentByEmail(user.email)) {
    redirect("/forbidden");
  }
  const agentEmail = user.email;

  const [stats, myLoans, overdueLoans] = await Promise.all([
    systemDb.maybeOne<LoanStats>(
      `select
         count(*)::int as total_applications,
         count(*) filter (where assessment_status = 'pending')::int as pending_assessment,
         count(*) filter (where status = 'approved')::int as approved,
         count(*) filter (where status = 'disbursed')::int as disbursed,
         count(*) filter (where status = 'repaid')::int as repaid,
         count(*) filter (where status = 'rejected')::int as rejected,
         count(*) filter (where status = 'defaulted')::int as defaulted,
         count(*) filter (where status = 'disbursed' and loan_paid_off = false and next_payment_due < now())::int as overdue,
         coalesce(sum(loan_amount_figures),0)::numeric as total_amount_lent,
         coalesce(sum(amount_paid),0)::numeric as total_amount_repaid,
         (coalesce(sum(total_repayable),0) - coalesce(sum(amount_paid),0))::numeric as outstanding_balance
       from loan_applications
      where agent_assigned = $1`,
      [agentEmail],
    ),
    systemDb.query<LoanRow>(
      `select l.id, l.full_name, u.email, l.phone_1, l.loan_amount_figures,
                l.loan_type, l.total_repayable, l.amount_paid, l.status,
                l.assessment_status, l.agent_decision, l.agent_name,
                l.money_sent, l.loan_paid_off, l.next_payment_due,
                l.repayment_frequency, l.duration_months, l.created_at,
                l.agent_assigned
           from loan_applications l
           left join users u on u.id = l.user_id
          where l.agent_assigned = $1
          order by l.created_at desc`,
      [agentEmail],
    ),
    systemDb.query<LoanRow>(
      `select l.id, l.full_name, u.email, l.phone_1, l.loan_amount_figures,
                l.loan_type, l.total_repayable, l.amount_paid, l.status,
                l.next_payment_due, l.repayment_frequency, l.agent_name
           from loan_applications l
           left join users u on u.id = l.user_id
          where l.agent_assigned = $1
            and l.status = 'disbursed'
            and l.loan_paid_off = false
            and l.next_payment_due < now()
          order by l.next_payment_due asc`,
      [agentEmail],
    ),
  ]);

  const overdueAmount = overdueLoans.reduce(
    (sum, l) => sum + Number(l.total_repayable) - Number(l.amount_paid),
    0,
  );

  return (
    <div className="space-y-4 ivh-animate-in">
      <div className="ivh-animate-in ivh-stagger-1">
        <PageHeader
          title="My Loans"
          description={`Loan applications assigned to you ({agentEmail}). Review and assess loans from your dashboard.`}
        />
        <p className="mt-1 text-xs text-ink-500">
          Signed in as <strong>{user.fullName}</strong> · {agentEmail}
        </p>
      </div>

      {/* Overview stats — loan only */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6 ivh-animate-in ivh-stagger-2">
        <StatCard
          label="Total applications"
          value={stats?.total_applications ?? 0}
          hint="Loans assigned to you"
          icon={<Users className="size-4" />}
        />
        <StatCard
          label="Pending assessment"
          value={stats?.pending_assessment ?? 0}
          hint="Awaiting your review"
          icon={<Clock className="size-4" />}
          tone="warning"
        />
        <StatCard
          label="Approved"
          value={stats?.approved ?? 0}
          icon={<CreditCard className="size-4" />}
          tone="success"
        />
        <StatCard
          label="Disbursed"
          value={stats?.disbursed ?? 0}
          hint="Funds sent"
          icon={<Wallet className="size-4" />}

        />
        <StatCard
          label="Repaid"
          value={stats?.repaid ?? 0}
          icon={<RefreshCw className="size-4" />}
          tone="success"
        />
        <StatCard
          label="Overdue"
          value={stats?.overdue ?? 0}
          hint={`₦${overdueAmount.toLocaleString()} outstanding`}
          icon={<AlertCircle className="size-4" />}
          tone="danger"
        />
      </div>

      {/* Financial summary */}
      <div className="grid gap-3 sm:grid-cols-3 ivh-animate-in ivh-stagger-3">
        <StatCard
          label="Total amount lent"
          value={formatMoney(Number(stats?.total_amount_lent ?? 0))}
          icon={<Wallet className="size-4" />}
        />
        <StatCard
          label="Total amount repaid"
          value={formatMoney(Number(stats?.total_amount_repaid ?? 0))}
          icon={<RefreshCw className="size-4" />}
          tone="success"
        />
        <StatCard
          label="Outstanding balance"
          value={formatMoney(Number(stats?.outstanding_balance ?? 0))}
          icon={<CreditCard className="size-4" />}
          tone="danger"
        />
      </div>

      {/* Overdue loans alert */}
      {overdueLoans.length > 0 && (
        <div className="ivh-animate-in ivh-stagger-4">
          <Alert tone="danger">
            <p className="font-semibold">
              {overdueLoans.length} overdue loan payment{overdueLoans.length === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-ink-600 mt-1">
              Total outstanding: {formatMoney(overdueAmount)}
            </p>
          </Alert>
        </div>
      )}

      {/* My loans table */}
      <div className="ivh-animate-in ivh-stagger-5">
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
                    Paid
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">
                    Assessment
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">
                    Next due
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">
                    Applied
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {myLoans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-ink-500">
                      No loans assigned to you yet.
                    </td>
                  </tr>
                ) : (
                  myLoans.map((loan) => {
                    const isOverdue =
                      loan.next_payment_due &&
                      new Date(loan.next_payment_due) < new Date() &&
                      !loan.loan_paid_off;
                    return (
                      <tr
                        key={loan.id}
                        className="hover:bg-ink-50 transition-colors"
                      >
                        <td className="px-5 py-3">
                          <div className="font-medium text-ink-900">
                            {loan.full_name}
                          </div>
                          <p className="text-xs text-ink-500">
                            {loan.email ?? "—"}
                          </p>
                        </td>
                        <td className="px-5 py-3">
                          <p className="font-medium text-ink-900">
                            {formatMoney(loan.loan_amount_figures)}
                          </p>
                          <p className="text-xs text-ink-500">
                            {loan.loan_type.replace("_", " ")} ·
                            {loan.duration_months} month{loan.duration_months === 1 ? "" : "s"}
                          </p>
                        </td>
                        <td className="px-5 py-3">
                          <p className="font-medium text-ink-900">
                            {formatMoney(loan.total_repayable)}
                          </p>
                        </td>
                        <td className="px-5 py-3">
                          <p className="font-medium text-brand-700">
                            {formatMoney(loan.amount_paid)}
                          </p>
                          <p className="text-xs text-ink-400">
                            {Math.round(
                              (Number(loan.amount_paid) /
                                Number(loan.total_repayable)) *
                                100,
                            )}%
                          </p>
                        </td>
                        <td className="px-5 py-3">
                          <Badge
                            tone={
                              loan.status === "repaid"
                                ? "success"
                                : loan.status === "disbursed"
                                  ? isOverdue
                                    ? "danger"
                                    : "info"
                                  : loan.status === "approved"
                                    ? "warning"
                                    : loan.status === "rejected"
                                      ? "danger"
                                      : "neutral"
                            }
                          >
                            {loan.status.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="px-5 py-3">
                          <Badge
                            tone={
                              loan.assessment_status === "completed"
                                ? "success"
                                : "warning"
                            }
                          >
                            {loan.assessment_status.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="px-5 py-3">
                          {loan.next_payment_due ? (
                            <p className={`text-xs font-medium ${isOverdue ? "text-red-600" : "text-ink-900"}`}>
                              {new Date(loan.next_payment_due).toLocaleDateString(
                                undefined,
                                { month: "short", day: "numeric" },
                              )}
                            </p>
                          ) : (
                            <p className="text-xs text-ink-400">—</p>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-xs text-ink-500">
                            {timeAgo(loan.created_at)}
                          </p>
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
    </div>
  );
}
