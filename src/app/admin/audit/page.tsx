import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { RealtimeAudit } from "@/components/realtime-audit";

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
    systemDb.one<{ count: number }>(
      `select count(*)::int as count from activity_logs a ${where}`,
      params,
    ),
  ]);

  return (
    <RealtimeAudit
      initialRows={rows}
      initialCount={count.count}
      q={q ?? ""}
      actor={actor}
    />
  );
}
