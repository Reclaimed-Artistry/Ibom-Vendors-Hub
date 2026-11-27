"use client";

import { useState } from "react";
import Link from "next/link";
import { SmartSearch } from "@/components/smart-search";
import { ScrollText } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { Badge, EmptyState, PageHeader, Pagination } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

interface PollAuditRow {
  id: string;
  action: string;
  actor_role: string;
  entity_type: string | null;
  entity_id: string | null;
  description: string | null;
  store_name: string | null;
  actor_email: string | null;
  created_at: string;
}

interface PollAuditResponse {
  rows: PollAuditRow[];
  updatedAt: string;
}

interface RealtimeAuditProps {
  initialRows: PollAuditRow[];
  initialCount: number;
  q: string;
  actor: string;
}

export function RealtimeAudit({
  initialRows,
  initialCount,
  q,
  actor,
}: RealtimeAuditProps) {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 40;

  const { data, error } = usePoll<PollAuditResponse>(
    async () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (actor !== "all") params.set("actor", actor);
      params.set("page", String(page));
      const res = await fetch(`/api/poll/audit?${params.toString()}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error("Failed to fetch audit log");
      return res.json();
    },
    500,
    { rows: initialRows, updatedAt: new Date().toISOString() }
  );

  const rows = data?.rows ?? initialRows;
  const count = initialCount;

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const buildHref = (target: number) => {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    if (actor !== "all") query.set("actor", actor);
    query.set("page", String(target));
    return `/admin/audit?${query.toString()}`;
  };

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <SmartSearch
          bare
          action="/admin/audit"
          placeholder="Filter by action, description, or entity type"
          initialQuery={q}
          items={rows.map((entry: PollAuditRow) => ({
            title: entry.action,
            subtitle: `${entry.actor_email ?? "—"} · ${entry.store_name ?? "—"}`,
            href: `/admin/audit?q=${encodeURIComponent(entry.action)}`,
            searchText: `${entry.action} ${entry.description ?? ""} ${entry.entity_type ?? ""}`,
            icon: "record",
          }))}
        />
        {(q || actor !== "all") ? (
          <Link href="/admin/audit" className="btn btn-ghost btn-sm">
            Reset
          </Link>
        ) : null}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="size-5" />}
          title="No matching entries"
          description="Actions are recorded as they happen."
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Store</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry: PollAuditRow) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap text-xs text-ink-500">
                    {formatDateTime(entry.created_at)}
                  </td>
                  <td>
                    <p className="font-mono text-xs text-ink-800">
                      {entry.action}
                    </p>
                    {entry.entity_type ? (
                      <p className="text-[11px] text-ink-400">
                        {entry.entity_type}
                      </p>
                    ) : null}
                  </td>
                  <td className="text-xs">
                    <Badge
                      tone={
                        entry.actor_role === "admin"
                          ? "info"
                          : entry.actor_role === "vendor"
                            ? "success"
                            : "neutral"
                      }
                    >
                      {entry.actor_role}
                    </Badge>
                    {entry.actor_email ? (
                      <p className="mt-0.5 text-[11px] text-ink-400">
                        {entry.actor_email}
                      </p>
                    ) : null}
                  </td>
                  <td className="text-xs text-ink-600">
                    {entry.store_name ?? "—"}
                  </td>
                  <td className="max-w-md text-sm text-ink-600">
                    {entry.description ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <Pagination page={page} totalPages={totalPages} buildHref={buildHref} />
      ) : null}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Failed to fetch live updates: {error.message}
        </div>
      )}
    </div>
  );
}
