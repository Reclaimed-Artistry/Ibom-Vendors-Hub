import type { Metadata } from "next";
import Link from "next/link";
import { Mail, RotateCcw, Search } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { getSettings, emailFrom, resendKey } from "@/lib/settings";
import { formatDateTime } from "@/lib/utils";
import { Alert, Badge, EmptyState, PageHeader, Pagination, Tabs } from "@/components/ui";
import { EmailTestForm, RetryEmailsButton } from "@/components/admin-forms";

export const metadata: Metadata = { title: "Emails · Admin" };

const PAGE_SIZE = 30;

const STATUSES = ["all", "sent", "failed", "skipped", "queued"] as const;

function tone(status: string) {
  if (status === "sent") return "success" as const;
  if (status === "failed") return "danger" as const;
  if (status === "queued") return "warning" as const;
  return "neutral" as const;
}

export default async function AdminEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string; retried?: string; attempted?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const settings = await getSettings();
  const status = STATUSES.includes((params.status ?? "all") as (typeof STATUSES)[number]) ? params.status ?? "all" : "all";
  const q = params.q?.trim() ?? "";
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const filters: string[] = [];
  const values: unknown[] = [];
  if (status !== "all") {
    values.push(status);
    filters.push(`status = $${values.length}`);
  }
  if (q) {
    values.push(`%${q}%`);
    filters.push(`(to_email ilike $${values.length} or subject ilike $${values.length} or template ilike $${values.length})`);
  }
  const where = filters.length ? `where ${filters.join(" and ")}` : "";

  const [rows, counts, recent] = await Promise.all([
    systemDb.query<{
      id: string;
      to_email: string;
      template: string;
      subject: string;
      status: string;
      provider: string;
      attempts: number;
      error: string | null;
      sent_at: string | null;
      created_at: string;
    }>(
      `select id, to_email, template, subject, status, provider, attempts, error, sent_at, created_at
         from email_logs ${where}
        order by created_at desc
        limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`,
      values,
    ),
    systemDb.one<{ total: number }>(`select count(*)::int as total from email_logs ${where}`, values),
    systemDb.maybeOne<{ sent: number; failed: number; skipped: number; queued: number; last24: number }>(
      `select count(*) filter (where status = 'sent')::int as sent,
              count(*) filter (where status = 'failed')::int as failed,
              count(*) filter (where status = 'skipped')::int as skipped,
              count(*) filter (where status = 'queued')::int as queued,
              count(*) filter (where created_at > now() - interval '24 hours')::int as last24
         from email_logs`,
    ),
  ]);

  const totalPages = Math.max(1, Math.ceil(counts.total / PAGE_SIZE));
  const providerReady = Boolean(resendKey(settings));
  const retried = params.retried !== undefined;

  const buildHref = (target: number) => {
    const query = new URLSearchParams();
    if (status !== "all") query.set("status", status);
    if (q) query.set("q", q);
    query.set("page", String(target));
    return `/admin/emails?${query.toString()}`;
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Transactional email"
        description="Every message the platform renders — receipts, order updates, password resets, subscription reminders — is stored here with its provider status."
        actions={
          (recent?.failed ?? 0) > 0 ? (
            <RetryEmailsButton />
          ) : null
        }
      />

      {retried ? (
        <Alert tone="success" title="Retry finished">
          Attempted {params.attempted ?? "0"} failed message(s); {params.retried ?? "0"} accepted by the provider. Any that still fail stay listed below with the provider error.
        </Alert>
      ) : null}

      {providerReady ? (
        <Alert tone={recent?.failed ? "warning" : "info"} title={`Sending through Resend as ${emailFrom(settings)}`}>
          Delivery requires the from address to sit on a domain or address verified in your Resend account
          (resend.com/domains). Until then Resend answers 403 and the failure is recorded below. Without a verified
          domain you can only deliver to the Resend account owner, from <span className="font-mono">onboarding@resend.dev</span>.
        </Alert>
      ) : (
        <Alert tone="warning" title="No email provider configured">
          Messages are still rendered and stored here, but nothing leaves the platform. Add <span className="font-mono">RESEND_API_KEY</span> to
          the Vercel environment (or save a key in Platform settings) to switch sending on.
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Delivered", value: recent?.sent ?? 0, hint: "accepted by the provider" },
          { label: "Failed", value: recent?.failed ?? 0, hint: "rejected or unreachable" },
          { label: "Skipped", value: recent?.skipped ?? 0, hint: "no provider configured" },
          { label: "Last 24 hours", value: recent?.last24 ?? 0, hint: "messages rendered" },
        ].map((stat) => (
          <div key={stat.label} className="card card-pad">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold text-ink-900">{stat.value}</p>
            <p className="text-xs text-ink-500">{stat.hint}</p>
          </div>
        ))}
      </div>

      <EmailTestForm defaultTo="" />

      <Tabs
        links={STATUSES.map((option) => ({
          href: option === "all" ? "/admin/emails" : `/admin/emails?status=${option}`,
          label: option === "all" ? "All" : option.charAt(0).toUpperCase() + option.slice(1),
          active: status === option,
        }))}
      />

      <form className="card card-pad flex flex-wrap items-end gap-3" action="/admin/emails">
        {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
        <label className="min-w-0 w-full flex-1 sm:w-auto sm:min-w-56">
          <span className="label">Search</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <input name="q" defaultValue={q} className="input pl-9" placeholder="Recipient, subject or template" />
          </span>
        </label>
        <button type="submit" className="btn btn-secondary">
          Search
        </button>
        {q || status !== "all" ? (
          <Link href="/admin/emails" className="btn btn-ghost btn-sm">
            Reset
          </Link>
        ) : null}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Mail className="size-5" />}
          title="No messages yet"
          description="Receipts, password resets and subscription notices appear here the moment they are rendered."
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>To</th>
                <th>Message</th>
                <th>Status</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap text-xs text-ink-500">
                    {formatDateTime(row.sent_at ?? row.created_at)}
                  </td>
                  <td className="text-xs text-ink-700">{row.to_email}</td>
                  <td className="max-w-sm">
                    <p className="truncate text-sm font-medium text-ink-900">{row.subject}</p>
                    <p className="font-mono text-[11px] text-ink-400">{row.template}</p>
                  </td>
                  <td>
                    <Badge tone={tone(row.status)}>{row.status}</Badge>
                    <p className="mt-0.5 text-[11px] text-ink-400">
                      {row.provider}
                      {row.attempts > 0 ? ` · ${row.attempts} attempt${row.attempts === 1 ? "" : "s"}` : ""}
                    </p>
                  </td>
                  <td className="max-w-md text-xs text-ink-500">{row.error ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} buildHref={buildHref} />

      <p className="flex items-center gap-1.5 text-xs text-ink-400">
        <RotateCcw className="size-3.5" /> Failed messages are retried automatically by the daily cron (up to three attempts).
      </p>
    </div>
  );
}
