import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { systemDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  await requireAdmin();

  const rows = await systemDb.query<{
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
      order by a.created_at desc
      limit 40`
  );

  return NextResponse.json({ rows, updatedAt: new Date().toISOString() });
}
