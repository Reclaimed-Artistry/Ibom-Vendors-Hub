import { systemDb, type Db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
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
    const inserted = await systemDb.maybeOne<{ id: string }>(
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
    // Only newly created admin notifications are mirrored. Customer/vendor
    // notifications remain private and retries cannot resend the same alert.
    if (inserted) {
      const recipient = await systemDb.maybeOne<{ email: string }>(
        `select email from users where id=$1 and role in ('admin','super_admin') and status='active'`,
        [input.userId],
      );
      if (recipient) {
        const copies = process.env.ADMIN_NOTIFICATION_COPY_EMAILS ?? "victorgodwininyang@gmail.com";
        const recipients = new Set([recipient.email, ...copies.split(",")].map((email) => email.trim().toLowerCase()).filter(Boolean));
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
