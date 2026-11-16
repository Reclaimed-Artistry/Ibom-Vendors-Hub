import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { timeAgo } from "@/lib/utils";
import { markNotificationsReadAction } from "@/app/actions/vendor";
import { EmptyState, PageHeader, Tabs } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { MarkNotificationRead } from "@/components/mark-notification-read";

export const metadata: Metadata = { title: "Notifications · Ibom Vendors Hub" };

async function markRead(id: string) {
  "use server";
  const user = await requireUser(["customer"]);
  await systemDb.execute(`update notifications set read_at = now() where id = $1 and user_id = $2`, [id, user.id]);
}

export default async function AccountNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await requireUser(["customer"]);
  const { filter = "all" } = await searchParams;
  const rows = await systemDb.query<{ id: string; title: string; body: string | null; action_url: string | null; read_at: string | null; created_at: string; type: string }>(
    `select id, title, body, action_url, read_at, created_at, type from notifications
      where user_id = $1 ${filter === "unread" ? "and read_at is null" : ""}
      order by created_at desc limit 100`,
    [user.id],
  );
  const unread = rows.filter((row) => !row.read_at).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        description="Order updates, quotation replies and store announcements."
        actions={
          <form action={markNotificationsReadAction}>
            <SubmitButton className="btn-secondary btn-sm" pendingLabel="Marking…">Mark all read</SubmitButton>
          </form>
        }
      />
      <Tabs
        links={[
          { href: "/account/notifications", label: "All", active: filter === "all" },
          { href: "/account/notifications?filter=unread", label: "Unread", active: filter === "unread", badge: unread || undefined },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState icon={<Bell className="size-5" />} title="Nothing here" description="You are all caught up." />
      ) : (
        <ul className="space-y-2">
          {rows.map((item) => (
            <li key={item.id} className={`card px-4 py-3 ${item.read_at ? "" : "border-brand-200 bg-brand-50/40"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                    {!item.read_at ? <span className="size-2 rounded-full bg-brand-500" aria-label="Unread" /> : null}
                    {item.title}
                  </p>
                  {item.body ? <p className="mt-0.5 text-sm text-ink-600">{item.body}</p> : null}
                  <p className="mt-1 text-xs text-ink-400">{timeAgo(item.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  {item.action_url ? <Link href={item.action_url} className="text-xs font-semibold text-brand-700 hover:underline">Open</Link> : null}
                  {!item.read_at ? <MarkNotificationRead id={item.id} action={markRead} /> : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
