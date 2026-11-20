import { systemDb, type Db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { adminEmailRecipients } from "@/lib/admin-email-recipients";
import { url } from "@/lib/settings";

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
    let inserted = await systemDb.maybeOne<{ id: string }>(
      `insert into notifications (user_id, store_id, type, title, body, action_url, dedupe_key)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (dedupe_key) do nothing returning id`,
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
    // An existing notification may predate email mirroring or a prior attempt
    // may have stopped after inserting it. Email dedupe, not notification
    // insertion, determines whether a copy still needs to be created.
    if (!inserted && input.dedupeKey) {
      inserted = await systemDb.maybeOne<{ id: string }>(
        `select id from notifications where dedupe_key=$1 and user_id=$2`,
        [input.dedupeKey, input.userId],
      );
    }
    // Customer/vendor notifications remain private.
    if (inserted) {
      const recipient = await systemDb.maybeOne<{ email: string }>(
        `select email from users where id=$1 and role in ('admin','super_admin') and status='active'`,
        [input.userId],
      );
      if (recipient) {
        const recipients = adminEmailRecipients([recipient.email]);
        const path = input.actionUrl?.startsWith("/") && !input.actionUrl.startsWith("//") ? input.actionUrl : "/admin/notifications";
        for (const email of recipients) {
          await sendEmail({
            to: email,
            template: "admin_notification",
            data: { subject: input.title, message: input.body ?? "You have a new notification on Ibomvendorshub.", link: url(path) },
            dedupeKey: `notification-email:${inserted.id}:${email}`,
          });
        }
      }
    }
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

/** Recover missing email copies from durable notifications, including pre-fix alerts.
 * Run outside business transactions; dedupe keys also make concurrent drains safe.
 */
export async function recoverAdminNotificationEmails(limit = 20) {
  const rows = await systemDb.query<{ id: string; email: string; title: string; body: string | null; action_url: string | null }>(
    `select n.id, u.email, n.title, n.body, n.action_url
       from notifications n join users u on u.id=n.user_id
      where u.role in ('admin','super_admin') and u.status='active'
        and n.created_at > now() - interval '7 days'
      order by n.created_at desc`,
  );
  let attempted = 0;
  for (const row of rows) {
    for (const to of adminEmailRecipients([row.email])) {
      const key = `notification-email:${row.id}:${to}`;
      const existing = await systemDb.maybeOne(`select id from email_logs where dedupe_key=$1`, [key]);
      if (existing) continue;
      const path = row.action_url?.startsWith('/') && !row.action_url.startsWith('//') ? row.action_url : '/admin/notifications';
      await sendEmail({ to, template: 'admin_notification', data: { subject: row.title, message: row.body ?? '', link: url(path) }, dedupeKey: key });
      if (++attempted >= limit) return { attempted };
    }
  }
  return { attempted };
}
