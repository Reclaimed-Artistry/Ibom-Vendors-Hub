import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { getLoanAgentByEmail, getLoanAgents } from "@/lib/loan-agents";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/utils";
import { Badge, PageHeader } from "@/components/ui";
import Link from "next/link";
import { Users, Wallet, Clock, CreditCard } from "lucide-react";

export const metadata: Metadata = { title: "All Agents · Loan Officer" };

interface AgentSummary {
  email: string;
  name: string;
  phone?: string;
  total_applications: number;
  pending_assessment: number;
  approved: number;
  disbursed: number;
  total_amount_lent: number;
  outstanding_balance: number;
}

export default async function AgentAllAgentsPage() {
  const user = await requireUser();
  if (!getLoanAgentByEmail(user.email)) {
    redirect("/forbidden");
  }
  const agentEmail = user.email;

  const allAgents = getLoanAgents();

  // Fetch per-agent stats from the database.
  const agentStats = await systemDb.query<{
    agent_email: string;
    total_applications: number;
    pending_assessment: number;
    approved: number;
    disbursed: number;
    repaid: number;
    rejected: number;
    total_amount_lent: number;
    total_amount_repaid: number;
    outstanding_balance: number;
  }>(
    `select
       agent_assigned as agent_email,
       count(*)::int as total_applications,
       count(*) filter (where assessment_status = 'pending')::int as pending_assessment,
       count(*) filter (where status = 'approved')::int as approved,
       count(*) filter (where status = 'disbursed')::int as disbursed,
       count(*) filter (where status = 'repaid')::int as repaid,
       count(*) filter (where status = 'rejected')::int as rejected,
       coalesce(sum(loan_amount_figures),0)::numeric as total_amount_lent,
       coalesce(sum(amount_paid),0)::numeric as total_amount_repaid,
       (coalesce(sum(total_repayable),0) - coalesce(sum(amount_paid),0))::numeric as outstanding_balance
     from loan_applications
     group by agent_assigned`,
  );

  const statsByEmail = new Map(
    agentStats.map((s) => [s.agent_email?.toLowerCase(), s]),
  );

  const summaries: AgentSummary[] = allAgents.map((agent) => {
    const s = statsByEmail.get(agent.email.toLowerCase());
    return {
      email: agent.email,
      name: agent.name,
      phone: agent.phone,
      total_applications: s?.total_applications ?? 0,
      pending_assessment: s?.pending_assessment ?? 0,
      approved: s?.approved ?? 0,
      disbursed: s?.disbursed ?? 0,
      total_amount_lent: Number(s?.total_amount_lent ?? 0),
      outstanding_balance: Number(s?.outstanding_balance ?? 0),
    };
  });

  const grandTotals = summaries.reduce(
    (acc, s) => ({
      total_applications: acc.total_applications + s.total_applications,
      pending_assessment: acc.pending_assessment + s.pending_assessment,
      approved: acc.approved + s.approved,
      disbursed: acc.disbursed + s.disbursed,
      total_amount_lent: acc.total_amount_lent + s.total_amount_lent,
      outstanding_balance: acc.outstanding_balance + s.outstanding_balance,
    }),
    {
      total_applications: 0,
      pending_assessment: 0,
      approved: 0,
      disbursed: 0,
      total_amount_lent: 0,
      outstanding_balance: 0,
    },
  );

  const currentAgent = summaries.find((a) => a.email.toLowerCase() === agentEmail.toLowerCase());

  return (
    <div className="space-y-4 ivh-animate-in">
      <div className="ivh-animate-in ivh-stagger-1">
        <PageHeader
          title="All Loan Agents"
          description={`Overview of all loan officers and the applications assigned to them.`}
        />
        <p className="mt-1 text-xs text-ink-500">
          Signed in as <strong>{user.fullName}</strong> · {agentEmail}
        </p>
      </div>

      {/* Grand totals */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6 ivh-animate-in ivh-stagger-2">
        <div className="card card-pad">
          <p className="stat-label">Total agents</p>
          <p className="stat-value mt-1.5">{allAgents.length}</p>
        </div>
        <div className="card card-pad">
          <p className="stat-label">Total applications</p>
          <p className="stat-value mt-1.5">{grandTotals.total_applications}</p>
        </div>
        <div className="card card-pad">
          <p className="stat-label">Pending assessment</p>
          <p className="stat-value mt-1.5 text-amber-700 font-medium">
            {grandTotals.pending_assessment}
          </p>
        </div>
        <div className="card card-pad">
          <p className="stat-label">Approved</p>
          <p className="stat-value mt-1.5 text-brand-700 font-medium">
            {grandTotals.approved}
          </p>
        </div>
        <div className="card card-pad">
          <p className="stat-label">Disbursed</p>
          <p className="stat-value mt-1.5 text-brand-700 font-medium">
            {grandTotals.disbursed}
          </p>
        </div>
        <div className="card card-pad">
          <p className="stat-label">Total amount lent</p>
          <p className="stat-value mt-1.5 text-ink-900 font-medium">
            {formatMoney(grandTotals.total_amount_lent)}
          </p>
        </div>
      </div>

      {/* Agent roster */}
      <div className="ivh-animate-in ivh-stagger-3">
        <h2 className="text-sm font-semibold text-ink-900 mb-3">
          Agent roster
        </h2>
        <div className="rounded-xl border border-ink-100 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[900px]">
              <thead>
                <tr className="bg-ink-50 border-b border-ink-100">
                  <th className="px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">
                    Agent
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider text-right">
                    Applications
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider text-right">
                    Pending
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider text-right">
                    Approved
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider text-right">
                    Disbursed
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider text-right">
                    Amount lent
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider text-right">
                    Outstanding
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">
                    You
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {summaries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-ink-500">
                      No loan agents registered.
                    </td>
                  </tr>
                ) : (
                  summaries.map((agent) => {
                    const isMe = agent.email.toLowerCase() === agentEmail.toLowerCase();
                    return (
                      <tr
                        key={agent.email}
                        className={`hover:bg-ink-50 transition-colors ${isMe ? "bg-brand-50/50" : ""}`}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex shrink-0 items-center justify-center rounded-full bg-brand-800 text-xs font-bold text-white" style={{ width: 32, height: 32 }}>
                              {agent.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-ink-900">{agent.name}</p>
                              <p className="text-xs text-ink-500">{agent.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          {agent.phone ? (
                            <p className="text-xs text-ink-500">{agent.phone}</p>
                          ) : (
                            <p className="text-xs text-ink-400">—</p>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <p className="font-medium text-ink-900">
                            {agent.total_applications}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <p className={`text-xs font-medium ${agent.pending_assessment > 0 ? "text-amber-700" : "text-ink-500"}`}>
                            {agent.pending_assessment}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <p className="text-xs font-medium text-brand-700">
                            {agent.approved}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <p className="text-xs font-medium text-ink-900">
                            {agent.disbursed}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <p className="text-xs font-medium text-ink-900">
                            {formatMoney(agent.total_amount_lent)}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <p className={`text-xs font-medium ${agent.outstanding_balance > 0 ? "text-red-600" : "text-ink-500"}`}>
                            {formatMoney(agent.outstanding_balance)}
                          </p>
                        </td>
                        <td className="px-5 py-3">
                          {isMe ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold">
                              You
                            </span>
                          ) : null}
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
