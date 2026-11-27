import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { formatMoney, timeAgo } from "@/lib/utils";
import { Badge, PageHeader, StatCard } from "@/components/ui";
import {
  AlertCircle,
  ArrowRight,
  Clock,
  CreditCard,
  RefreshCw,
  Users,
  Wallet,
} from "lucide-react";

export const metadata: Metadata = { title: "Loan Overview · Admin" };

interface LoanStats {
  total_assigned: number;
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

export default async function AdminLoansOverviewPage() {
  const user = await requireAdmin();

  const [stats, allLoans, overdueLoans, recentActivity] =
    await Promise.all([
      systemDb.maybeOne<LoanStats>(
        `select
           count(*)::int as total_assigned,
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
         from loan_applications`,
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
          order by l.created_at desc`,
      ),
      systemDb.query<LoanRow>(
        `select l.id, l.full_name, u.email, l.phone_1, l.loan_amount_figures,
                l.loan_type, l.total_repayable, l.amount_paid, l.status,
                l.next_payment_due, l.repayment_frequency, l.agent_name
           from loan_applications l
           left join users u on u.id = l.user_id
          where l.status = 'disbursed'
            and l.loan_paid_off = false
            and l.next_payment_due < now()
          order by l.next_payment_due asc`,
      ),
      systemDb.query<{
        id: string;
        full_name: string;
        action: string;
        detail: string | null;
        created_at: string;
      }>(
        `select l.id, l.full_name,
             case
               when l.money_sent = true and l.loan_paid_off = false then 'Funds disbursed'
               when l.agent_decision = 'approve' then 'Application approved'
               when l.agent_decision = 'reject' then 'Application rejected'
               when l.assessment_status = 'completed' then 'Assessment completed'
               else 'Application submitted'
             end as action,
             l.agent_decision_notes as detail,
             l.updated_at as created_at
           from loan_applications l
          order by l.updated_at desc
          limit 20`,
      ),
    ]);

  const overdueAmount = overdueLoans.reduce(
    (sum, l) => sum + Number(l.total_repayable) - Number(l.amount_paid),
    0,
  );

  return (
    <div className="space-y-4 ivh-animate-in">
      <PageHeader
        title="Loan Overview"
        description={`Platform-wide loan statistics for ${user.email}.`}
        actions={
          <Link href="/admin/loan-assessments" className="btn-secondary">
            <ArrowRight className="ml-1 size-4" /> Review assessments
          </Link>
        }
      />

      {/* Overview stats */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6 ivh-animate-in ivh-stagger-2">
        <StatCard
          label="Total applications"
          value={stats?.total_assigned ?? 0}
          icon={<Users className="size-4" />}
        />
        <StatCard
          label="Awaiting assessment"
          value={stats?.pending_assessment ?? 0}
          hint="Not yet physically assessed"
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
          <Badge tone="danger">
            {overdueLoans.length} overdue loan payment
          </Badge>
          <p className="text-xs text-ink-600 mt-1">
            Total outstanding: {formatMoney(overdueAmount)}
          </p>
        </div>
      )}

      {/* All loans table */}
      <div className="ivh-animate-in ivh-stagger-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">
            All loan applications
          </h2>
        </div>
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
                    Paid
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
                    Applied
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {allLoans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-ink-500">
                      No loan applications yet.
                    </td>
                  </tr>
                ) : (
                  allLoans.map((loan) => {
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
                          <p className="text-xs text-ink-500">
                            {loan.agent_assigned ?? "—"}
                          </p>
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

      {/* Recent activity */}
      <div className="ivh-animate-in ivh-stagger-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400 mb-3">
          Recent activity
        </h2>
        <div className="rounded-xl border border-ink-100 bg-white shadow-sm">
          <ul className="divide-y divide-ink-100">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-ink-500 p-5">No recent activity.</p>
            ) : (
              recentActivity.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink-900">
                      {item.action}
                    </p>
                    <p className="text-xs text-ink-500">
                      {item.full_name} · {item.detail ?? ""}
                    </p>
                  </div>
                  <p className="text-xs text-ink-400">
                    {timeAgo(item.created_at)}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
