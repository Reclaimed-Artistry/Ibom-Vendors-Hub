import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { requireActiveVendorContext } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { timeAgo } from "@/lib/utils";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { MessageReplyForm } from "@/components/vendor-forms";

export const metadata: Metadata = { title: "Messages · Vendor dashboard" };

export default async function VendorMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; id?: string }>;
}) {
  const { store } = await requireActiveVendorContext();
  const { status = "all", id } = await searchParams;

  const params: unknown[] = [store.id];
  let where = "m.store_id = $1";
  if (status === "open") where += " and m.status in ('new','open')";
  if (status === "resolved") where += " and m.status in ('resolved','closed')";
  if (id) {
    params.push(id);
    where += ` and (m.id = $${params.length} or m.parent_id = $${params.length})`;
  }

  const rows = await systemDb.query<{
    id: string;
    sender_name: string;
    sender_email: string;
    sender_role: string;
    category: string;
    subject: string;
    body: string;
    status: string;
    created_at: string;
    order_reference: string | null;
    parent_id: string | null;
  }>(
    `select m.id, m.sender_name, m.sender_email, m.sender_role, m.category, m.subject, m.body, m.status,
            m.created_at, m.parent_id, o.reference as order_reference
       from customer_messages m left join orders o on o.id = m.order_id
      where ${where} order by m.created_at desc limit 80`,
    params,
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Messages" description="Customer questions and platform notices related to your store." />

      <Tabs
        links={[
          { href: "/vendor/messages?status=all", label: "All", active: status === "all" },
          { href: "/vendor/messages?status=open", label: "Open", active: status === "open" },
          { href: "/vendor/messages?status=resolved", label: "Resolved", active: status === "resolved" },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState icon={<MessageSquare className="size-5" />} title="No messages" description="Messages from customers and the platform team show up here." />
      ) : (
        <div className="space-y-3">
          {rows.map((message) => {
            const fromVendor = message.sender_role === "vendor";
            return (
              <Card key={message.id}>
                <CardHeader
                  title={message.subject}
                  description={`${fromVendor ? "You" : message.sender_name} · ${timeAgo(message.created_at)}${message.order_reference ? ` · ${message.order_reference}` : ""}`}
                  action={
                    <div className="flex items-center gap-2">
                      <Badge tone={message.category === "dispute" ? "danger" : message.category === "order" ? "info" : "neutral"}>{message.category}</Badge>
                      <Badge tone={message.status === "resolved" || message.status === "closed" ? "success" : "warning"}>{message.status.replace("_", " ")}</Badge>
                    </div>
                  }
                />
                <div className="card-pad">
                  <p className="whitespace-pre-line text-sm text-ink-700">{message.body}</p>
                  {!fromVendor ? (
                    <>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-400">
                        <a href={`mailto:${message.sender_email}`} className="font-semibold text-brand-700 hover:underline">{message.sender_email}</a>
                        {message.order_reference ? <Link href={`/vendor/orders?q=${message.order_reference}`} className="hover:underline">View order</Link> : null}
                        {message.parent_id ? <Link href={`/vendor/messages?id=${message.parent_id}`} className="hover:underline">View thread</Link> : null}
                      </div>
                      <MessageReplyForm messageId={message.id} />
                    </>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
