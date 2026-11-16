import { systemDb, type Db } from "@/lib/db";
import type { Role } from "@/lib/db";

export interface AuditInput {
  actorId?: string | null;
  actorRole?: Role | "system";
  storeId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string | null;
  description?: string;
  ip?: string | null;
  userAgent?: string | null;
  meta?: Record<string, unknown>;
}

/** Trusted audit writer — activity logs are append-only and never user-writable. */
export async function logActivity(input: AuditInput, db: Db = systemDb) {
  try {
    await db.execute(
      `insert into activity_logs
         (actor_id, actor_role, store_id, action, entity_type, entity_id, description, ip, user_agent, meta)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
      [
        input.actorId ?? null,
        input.actorRole ?? "system",
        input.storeId ?? null,
        input.action,
        input.entityType ?? null,
        input.entityId ?? null,
        input.description ?? null,
        input.ip ?? null,
        input.userAgent ?? null,
        JSON.stringify(input.meta ?? {}),
      ],
    );
  } catch (error) {
    console.error("audit log failed", error);
  }
}
