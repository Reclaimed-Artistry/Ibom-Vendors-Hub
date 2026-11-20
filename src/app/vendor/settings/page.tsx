import type { Metadata } from "next";
import { requireActiveVendorContext } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { Alert, Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { ProfileForm, ResendVerificationForm } from "@/components/profile-form";
import { LogoutButton } from "@/components/dashboard-nav";

export const metadata: Metadata = { title: "Account settings · Vendor dashboard" };

export default async function VendorSettingsPage() {
  const { user, store } = await requireActiveVendorContext();
  const dbUser = await systemDb.maybeOne<{ phone: string | null; created_at: string; last_login_at: string | null }>(
    `select phone, created_at, last_login_at from users where id = $1`,
    [user.id],
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Account settings" description="Your personal login details. Store details live under Store profile." />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Your details" description="Used on receipts and platform notices." />
          <ProfileForm fullName={user.fullName} email={user.email} phone={dbUser?.phone ?? ""} />
        </Card>

        <div className="space-y-4">
          <Card className="card-pad space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Account</p>
            <div className="flex items-center justify-between text-sm"><span className="text-ink-500">Role</span><Badge tone="info">{user.role}</Badge></div>
            <div className="flex items-center justify-between text-sm"><span className="text-ink-500">Store</span><span className="font-medium text-ink-800">{store.name}</span></div>
            <div className="flex items-center justify-between text-sm"><span className="text-ink-500">Joined</span><span className="font-medium text-ink-800">{formatDate(dbUser?.created_at)}</span></div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-500">Email status</span>
              <Badge tone={user.emailVerified ? "success" : "warning"}>{user.emailVerified ? "Verified" : "Unverified"}</Badge>
            </div>
          </Card>

          {!user.emailVerified ? (
            <Card className="card-pad space-y-2">
              <p className="text-sm font-semibold text-ink-900">Verify your email</p>
              <p className="text-sm text-ink-500">Order alerts and subscription reminders go to this address.</p>
              <ResendVerificationForm />
            </Card>
          ) : null}

          <Card className="card-pad space-y-2">
            <p className="text-sm font-semibold text-ink-900">Session</p>
            <p className="text-xs text-ink-500">You are signed in on this device. Sessions last seven days.</p>
            <div className="pt-1"><LogoutButton label="Sign out of this device" /></div>
          </Card>

          <Card className="card-pad">
            <Alert tone="info" title="Data protection">
              Suspending or lapsing your subscription never deletes your account, products, images or order history.
            </Alert>
          </Card>
        </div>
      </div>
    </div>
  );
}
