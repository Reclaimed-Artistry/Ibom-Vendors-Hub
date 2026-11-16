import type { Metadata } from "next";
import Link from "next/link";
import { Search, ScrollText } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { Badge, EmptyState, PageHeader, Pagination } from "@/components/ui";

export const metadata: Metadata = { title: "Audit log · Admin" };

const PAGE_SIZE = 40;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; actor?: string; page?: string }>;
}) {
  await requireAdmin();
  const { q, actor = "all", page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? 1) || 1);

  const params: unknown[] = [];
  const filters: string[] = [];
  if (q) {
    params.push(`%${q}%`);
    filters.push(`(a.action ilike $${params.length} or a.description ilike $${params.length} or a.entity_type ilike $${params.length})`);
  }
  if (actor !== "all") {
    params.push(actor);
    filters.push(`a.actor_role = $${params.length}`);
  }
  const where = filters.length ? `where ${filters.join(" and ")}` : "";

  const [rows, count] = await Promise.all([
    systemDb.query<{
      id: string;
      action: string;
      actor_role: string;
      entity_type: string | null;
      entity_id: string | null;
      description: string | null;
      store_name: string | null;
      actor_email: string | null;
      created_at: string;
    }>(
      `select a.id, a.action, a.actor_role, a.entity_type, a.entity_id, a.description,
              s.name as store_name, u.email as actor_email, a.created_at
         from activity_logs a
         left join stores s on s.id = a.store_id
         left join users u on u.id = a.actor_id
        ${where}
        order by a.created_at desc
        limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`,
      params,
    ),
    systemDb.one<{ count: number }>(`select count(*)::int as count from activity_logs a ${where}`, params),
  ]);

  const totalPages = Math.max(1, Math.ceil(count.count / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <PageHeader title="Audit log" description="Immutable record of every consequential action on the platform." />

      <form className="card card-pad flex flex-wrap items-end gap-3" action="/admin/audit">
        <label className="min-w-0 w-full flex-1 sm:w-auto sm:min-w-56">
          <span className="label">Search</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <input name="q" defaultValue={q ?? ""} className="input pl-9" placeholder="Action, entity or description" />
          </span>
        </label>
        <label className="w-40">
          <span className="label">Actor</span>
          <select name="actor" defaultValue={actor} className="select">
            <option value="all">All roles</option>
            <option value="admin">Admin</option>
            <option value="vendor">Vendor</option>
            <option value="customer">Customer</option>
            <option value="system">System</option>
          </select>
        </label>
        <button type="submit" className="btn btn-secondary">Filter</button>
        {q || actor !== "all" ? <Link href="/admin/audit" className="btn btn-ghost btn-sm">Reset</Link> : null}
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={<ScrollText className="size-5" />} title="No matching entries" description="Actions are recorded as they happen." />
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
              {rows.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap text-xs text-ink-500">{formatDateTime(entry.created_at)}</td>
                  <td>
                    <p className="font-mono text-xs text-ink-800">{entry.action}</p>
                    {entry.entity_type ? <p className="text-[11px] text-ink-400">{entry.entity_type}</p> : null}
                  </td>
                  <td className="text-xs">
                    <Badge tone={entry.actor_role === "admin" ? "info" : entry.actor_role === "vendor" ? "success" : "neutral"}>{entry.actor_role}</Badge>
                    {entry.actor_email ? <p className="mt-0.5 text-[11px] text-ink-400">{entry.actor_email}</p> : null}
                  </td>
                  <td className="text-xs text-ink-600">{entry.store_name ?? "—"}</td>
                  <td className="max-w-md text-sm text-ink-600">{entry.description ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <Pagination
          page={page}
          totalPages={totalPages}
          buildHref={(target) => {
            const query = new URLSearchParams();
            if (q) query.set("q", q);
            if (actor !== "all") query.set("actor", actor);
            query.set("page", String(target));
            return `/admin/audit?${query.toString()}`;
          }}
        />
      ) : null}
    </div>
  );
}
