import type { Metadata } from "next";
import Link from "next/link";
import { Globe, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { SubdomainReviewForm } from "@/components/admin-forms";

export const metadata: Metadata = { title: "Subdomain requests · Admin" };

export default async function AdminSubdomainsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const { status = "pending" } = await searchParams;

  const rows = await systemDb.query<{
    id: string;
    store_id: string;
    store_name: string;
    current_slug: string;
    requested_subdomain: string;
    reason: string | null;
    status: string;
    admin_note: string | null;
    created_at: string;
    owner_email: string;
  }>(
    `select r.id, r.store_id, s.name as store_name, s.slug as current_slug, r.requested_subdomain, r.reason,
            r.status, r.admin_note, r.created_at, u.email as owner_email
       from subdomain_change_requests r
       join stores s on s.id = r.store_id
       join users u on u.id = s.owner_id
      where ($1::text = 'all' or r.status = $1)
      order by r.created_at desc limit 80`,
    [status],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Subdomain change requests"
        description="Vendors cannot change their own address. Approving here updates the storefront URL and notifies the owner."
      />
      <Tabs
        links={[
          { href: "/admin/subdomains?status=pending", label: "Pending", active: status === "pending" },
          { href: "/admin/subdomains?status=approved", label: "Approved", active: status === "approved" },
          { href: "/admin/subdomains?status=rejected", label: "Rejected", active: status === "rejected" },
          { href: "/admin/subdomains?status=all", label: "All", active: status === "all" },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState icon={<Globe className="size-5" />} title="No requests" description="Vendors can request an address change from their store profile." />
      ) : (
        <div className="space-y-3">
          {rows.map((request) => (
            <Card key={request.id}>
              <CardHeader
                title={`${request.current_slug} → ${request.requested_subdomain}`}
                description={`${request.store_name} · ${request.owner_email} · ${formatDateTime(request.created_at)}`}
                action={<Badge tone={request.status === "pending" ? "warning" : request.status === "approved" ? "success" : "danger"}>{request.status}</Badge>}
              />
              <div className="card-pad grid gap-4 lg:grid-cols-2">
                <div className="space-y-2 text-sm">
                  <p className="text-ink-600">{request.reason ?? "No reason provided."}</p>
                  {request.admin_note ? <p className="rounded-lg bg-ink-50 p-2 text-xs text-ink-600">Admin note: {request.admin_note}</p> : null}
                  <Link href={`/admin/vendors/${request.store_id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
                    <ShieldCheck className="size-3.5" /> Open vendor record
                  </Link>
                </div>
                {request.status === "pending" ? <SubdomainReviewForm requestId={request.id} /> : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
