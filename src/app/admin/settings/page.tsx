import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { gatewayStatus, getSettings } from "@/lib/settings";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { PlatformSettingsForm } from "@/components/admin-forms";

export const metadata: Metadata = { title: "Platform settings · Admin" };

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getSettings();
  const gateway = gatewayStatus(settings);

  return (
    <div className="space-y-4">
      <PageHeader title="Platform settings" description="Branding, payments, commissions and platform-wide feature switches." />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Configuration" description="Service keys are stored server-side and never exposed to the browser." />
          <div className="card-pad">
            <PlatformSettingsForm
              values={{
                platformName: settings.platform_name,
                tagline: settings.tagline,
                supportEmail: settings.support_email,
                supportPhone: settings.support_phone,
                mainDomain: settings.main_domain,
                commissionRate: Number(settings.commission_rate),
                trialDays: settings.default_trial_days,
                graceDays: settings.grace_period_days,
                requireApproval: settings.require_vendor_approval,
                paymentsEnabled: settings.payments_enabled,
                sandboxPayments: settings.sandbox_payments,
                maintenanceMode: settings.maintenance_mode,
                paystackPublicKey: settings.paystack_public_key ?? "",
                hasPaystackSecret: Boolean(settings.paystack_secret_key || process.env.PAYSTACK_SECRET_KEY),
                emailFrom: settings.email_from ?? "",
              }}
            />
          </div>
        </Card>


        <div className="space-y-4">
          <Card className="card-pad space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-900"><AlertTriangle className="size-4 text-amber-500" /> Payment mode</p>
            <p className="text-sm text-ink-500">
              {gateway.mode === "paystack"
                ? `Paystack (${gateway.secretKind} keys from ${gateway.secretSource}): orders are verified server-side before they are accepted.`
                : "Sandbox: customers see a confirmation page and no money moves."}
            </p>
            <p className="text-xs text-ink-400">
              Public key: {gateway.publicConfigured ? `${gateway.publicHint} (${gateway.publicSource})` : "not configured"} · Secret key:{" "}
              {gateway.secretConfigured ? `configured (${gateway.secretSource})` : "not configured"}
            </p>
            {gateway.warnings.map((warning) => (
              <p key={warning} className="text-xs text-amber-600">{warning}</p>
            ))}
            <p className="text-xs text-ink-400">
              Webhook endpoint: <span className="font-mono">/api/webhooks/paystack</span> — verifies the signature and amount before confirming a payment.
            </p>
          </Card>

          <Card className="card-pad space-y-2">
            <p className="text-sm font-semibold text-ink-900">Scheduled jobs</p>
            <p className="text-sm text-ink-500">A daily Vercel cron calls <span className="font-mono text-xs">/api/cron/subscriptions</span> to send expiry reminders, mark lapsed stores offline and retain all data.</p>
            <p className="text-xs text-ink-400">Requires the <span className="font-mono">CRON_SECRET</span> environment variable.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
