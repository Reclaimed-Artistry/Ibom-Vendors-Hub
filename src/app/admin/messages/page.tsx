import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { timeAgo } from "@/lib/utils";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { AdminMessageForm } from "@/components/admin-forms";
import { KycDocumentReviewPanel } from "@/components/kyc-document-review";

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
    store_slug: string | null;
    store_status: string | null;
    store_created_at: string | null;
    review_deadline_at: string | null;
    store_city: string | null;
    store_state: string | null;
    store_address: string | null;
    store_logo_url: string | null;
    store_cover_url: string | null;
    category_name: string | null;
    owner_name: string | null;
    owner_email: string | null;
    owner_phone: string | null;
    nin: string | null;
    proof_of_residence_type: string | null;
    proof_of_residence_url: string | null;
    cac_registered: boolean | null;
    cac_number: string | null;
    kyc_status: string | null;
    sender_name: string;
    sender_email: string;
    sender_role: string;
    category: string;
    subject: string;
    body: string;
    status: string;
    created_at: string;
  }>(
    `select m.id, m.store_id,
            s.name as store_name, s.slug as store_slug, s.status as store_status,
            s.created_at as store_created_at, s.review_deadline_at,
            s.city as store_city, s.state as store_state, s.address as store_address,
            s.logo_url as store_logo_url, s.cover_url as store_cover_url,
            c.name as category_name,
            u.full_name as owner_name, u.email as owner_email, u.phone as owner_phone,
            vp.nin, vp.proof_of_residence_type, vp.proof_of_residence_url,
            vp.cac_registered, vp.cac_number, vp.kyc_status,
            m.sender_name, m.sender_email, m.sender_role,
            m.category, m.subject, m.body, m.status, m.created_at
       from customer_messages m
       left join stores s on s.id = m.store_id
       left join store_categories c on c.id = s.category_id
       left join users u on u.id = s.owner_id
       left join vendor_profiles vp on vp.user_id = s.owner_id
      where (m.sender_role <> 'vendor' or (m.category = 'store_approval' and m.sender_role = 'vendor'))
        and (
          $1::text = 'all'
          or ($1::text = 'open' and m.status in ('new','open'))
          or ($1::text = 'store_approval' and m.category = 'store_approval')
          or m.status = $1
        )
      order by m.created_at desc limit 60`,
    [status],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Messages & Storefront Reviews"
        description="48-hour storefront registration approvals, support enquiries, order disputes and contact submissions."
      />
      <Tabs
        links={[
          { href: "/admin/messages", label: "Open", active: status === "open" },
          { href: "/admin/messages?status=store_approval", label: "Storefront Reviews (48h)", active: status === "store_approval" },
          { href: "/admin/messages?status=awaiting_customer", label: "Awaiting reply", active: status === "awaiting_customer" },
          { href: "/admin/messages?status=resolved", label: "Resolved", active: status === "resolved" },
          { href: "/admin/messages?status=all", label: "All", active: status === "all" },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState icon={<MessageSquare className="size-5" />} title="Inbox clear" description="New storefront approval requests and messages appear here." />
      ) : (
        <div className="space-y-4">
          {rows.map((message) => {
            const isStoreApproval = message.category === "store_approval" && message.store_id;
            return (
              <Card key={message.id}>
                <CardHeader
                  title={message.subject}
                  description={`${message.sender_name} · ${message.sender_email} · ${timeAgo(message.created_at)}`}
                  action={
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          message.category === "store_approval"
                            ? "warning"
                            : message.category === "dispute"
                              ? "danger"
                              : message.category === "order"
                                ? "info"
                                : "neutral"
                        }
                      >
                        {message.category === "store_approval" ? "48h Store Review" : message.category}
                      </Badge>
                      <Badge tone={message.status === "resolved" || message.status === "closed" ? "success" : "warning"}>
                        {message.status.replace("_", " ")}
                      </Badge>
                      {message.store_id ? (
                        <Link href={`/admin/vendors/${message.store_id}`} className="btn btn-secondary btn-sm">
                          Open vendor profile →
                        </Link>
                      ) : null}
                    </div>
                  }
                />
                {isStoreApproval ? (
                  <div className="card-pad space-y-4">
                    <KycDocumentReviewPanel
                      snapshot={{
                        storeId: message.store_id!,
                        storeName: message.store_name ?? message.sender_name,
                        storeSlug: message.store_slug ?? "",
                        storeStatus: message.store_status ?? "pending",
                        createdAt: message.store_created_at ?? message.created_at,
                        reviewDeadlineAt: message.review_deadline_at,
                        ownerName: message.owner_name ?? message.sender_name,
                        ownerEmail: message.owner_email ?? message.sender_email,
                        ownerPhone: message.owner_phone,
                        categoryName: message.category_name,
                        city: message.store_city,
                        state: message.store_state,
                        address: message.store_address,
                        logoUrl: message.store_logo_url,
                        coverUrl: message.store_cover_url,
                        nin: message.nin,
                        proofOfResidenceType: message.proof_of_residence_type,
                        proofOfResidenceUrl: message.proof_of_residence_url,
                        cacRegistered: message.cac_registered,
                        cacNumber: message.cac_number,
                        kycStatus: message.kyc_status,
                      }}
                      showDecisionActions={true}
                    />
                  </div>
                ) : (
                  <div className="card-pad grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <p className="whitespace-pre-line text-sm text-ink-700">{message.body}</p>
                      <p className="text-xs text-ink-400">
                        Store:{" "}
                        {message.store_id ? (
                          <Link href={`/admin/vendors/${message.store_id}`} className="font-semibold text-brand-700 hover:underline">
                            {message.store_name}
                          </Link>
                        ) : (
                          "Platform"
                        )}
                      </p>
                      <a href={`mailto:${message.sender_email}`} className="text-xs font-semibold text-brand-700 hover:underline">
                        Reply by email
                      </a>
                    </div>
                    <AdminMessageForm messageId={message.id} />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
