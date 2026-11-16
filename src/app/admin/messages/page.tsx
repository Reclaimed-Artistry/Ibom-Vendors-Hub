import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { timeAgo } from "@/lib/utils";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { AdminMessageForm } from "@/components/admin-forms";

export const metadata: Metadata = { title: "Messages · Admin" };

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const { status = "open" } = await searchParams;

  const rows = await systemDb.query<{
    id: string;
    store_id: string | null;
    store_name: string | null;
    sender_name: string;
    sender_email: string;
    sender_role: string;
    category: string;
    subject: string;
    body: string;
    status: string;
    created_at: string;
  }>(
    `select m.id, m.store_id, s.name as store_name, m.sender_name, m.sender_email, m.sender_role,
            m.category, m.subject, m.body, m.status, m.created_at
       from customer_messages m left join stores s on s.id = m.store_id
      where m.sender_role <> 'vendor'
        and ($1::text = 'all' or ($1::text = 'open' and m.status in ('new','open')) or m.status = $1)
      order by m.created_at desc limit 60`,
    [status],
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Messages" description="Support enquiries, order disputes and contact form submissions." />
      <Tabs
        links={[
          { href: "/admin/messages", label: "Open", active: status === "open" },
          { href: "/admin/messages?status=awaiting_customer", label: "Awaiting reply", active: status === "awaiting_customer" },
          { href: "/admin/messages?status=resolved", label: "Resolved", active: status === "resolved" },
          { href: "/admin/messages?status=all", label: "All", active: status === "all" },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState icon={<MessageSquare className="size-5" />} title="Inbox clear" description="New messages from customers and vendors appear here." />
      ) : (
        <div className="space-y-3">
          {rows.map((message) => (
            <Card key={message.id}>
              <CardHeader
                title={message.subject}
                description={`${message.sender_name} · ${message.sender_email} · ${timeAgo(message.created_at)}`}
                action={
                  <div className="flex items-center gap-2">
                    <Badge tone={message.category === "dispute" ? "danger" : message.category === "order" ? "info" : "neutral"}>{message.category}</Badge>
                    <Badge tone={message.status === "resolved" || message.status === "closed" ? "success" : "warning"}>{message.status.replace("_", " ")}</Badge>
                  </div>
                }
              />
              <div className="card-pad grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <p className="whitespace-pre-line text-sm text-ink-700">{message.body}</p>
                  <p className="text-xs text-ink-400">
                    Store:{" "}
                    {message.store_id ? (
                      <Link href={`/admin/vendors/${message.store_id}`} className="font-semibold text-brand-700 hover:underline">{message.store_name}</Link>
                    ) : "Platform"}
                  </p>
                  <a href={`mailto:${message.sender_email}`} className="text-xs font-semibold text-brand-700 hover:underline">Reply by email</a>
                </div>
                <AdminMessageForm messageId={message.id} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
