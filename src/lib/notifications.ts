import { systemDb, type Db } from "@/lib/db";

export interface NotificationInput {
  userId: string | null;
  storeId?: string | null;
  type: string;
  title: string;
  body?: string;
  actionUrl?: string;
  dedupeKey?: string;
}

/**
 * Idempotent in-app notification. Always executes via `systemDb` (nested
 * savepoint + `reset role` when inside `withActor`) because `notifications`
 * has no INSERT RLS policy for `app_runtime`.
 */
export async function notify(input: NotificationInput, _db?: Db) {
  void _db;
  if (!input.userId) return;
  try {
    await systemDb.execute(
      `insert into notifications (user_id, store_id, type, title, body, action_url, dedupe_key)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (dedupe_key) do nothing`,
      [
        input.userId,
        input.storeId ?? null,
        input.type,
        input.title,
        input.body ?? null,
        input.actionUrl ?? null,
        input.dedupeKey ?? null,
      ],
    );
  } catch (error) {
    console.error("notification failed", error);
  }
}

export async function notifyAdmins(
  input: Omit<NotificationInput, "userId">,
  _db?: Db,
) {
  void _db;
  try {
    const admins = await systemDb.query<{ id: string }>(
      `select id from users where role in ('admin','super_admin') and status = 'active'`,
    );
    for (const admin of admins) {
      await notify({
        ...input,
        userId: admin.id,
        dedupeKey: input.dedupeKey ? `${input.dedupeKey}:${admin.id}` : undefined,
      });
    }
  } catch (error) {
    console.error("notifyAdmins failed", error);
  }
}

export async function markNotificationRead(notificationId: string, userId: string) {
  await systemDb.execute(
    `update notifications set read_at = now() where id = $1 and user_id = $2`,
    [notificationId, userId],
  );
}
