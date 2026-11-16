import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { ProfileForm, ResendVerificationForm } from "@/components/profile-form";
import { LogoutButton } from "@/components/dashboard-nav";

export const metadata: Metadata = { title: "Profile & security · Ibom Vendors Hub" };

export default async function AccountProfilePage() {
  const user = await requireUser(["customer", "vendor", "admin", "super_admin"]);
  const row = await systemDb.maybeOne<{ phone: string | null; created_at: string; status: string }>(
    `select phone, created_at, status from users where id = $1`,
    [user.id],
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Profile & security" description="Keep your contact details current so vendors can reach you." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Your details" />
          <ProfileForm fullName={user.fullName} email={user.email} phone={row?.phone ?? ""} />
        </Card>
        <div className="space-y-4">
          <Card className="card-pad space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Account</p>
            <div className="flex items-center justify-between text-sm"><span className="text-ink-500">Status</span><Badge tone="success">{row?.status ?? "active"}</Badge></div>
            <div className="flex items-center justify-between text-sm"><span className="text-ink-500">Joined</span><span className="font-medium text-ink-800">{formatDate(row?.created_at)}</span></div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-500">Email</span>
              <Badge tone={user.emailVerified ? "success" : "warning"}>{user.emailVerified ? "Verified" : "Unverified"}</Badge>
            </div>
          </Card>
          {!user.emailVerified ? (
            <Card className="card-pad space-y-2">
              <p className="text-sm font-semibold text-ink-900">Verify your email</p>
              <p className="text-sm text-ink-500">Needed for order updates and receipts.</p>
              <ResendVerificationForm />
            </Card>
          ) : null}
          <Card className="card-pad space-y-2">
            <p className="text-sm font-semibold text-ink-900">Session</p>
            <p className="text-xs text-ink-500">Sessions expire after seven days.</p>
            <LogoutButton />
          </Card>
        </div>
      </div>
    </div>
  );
}
