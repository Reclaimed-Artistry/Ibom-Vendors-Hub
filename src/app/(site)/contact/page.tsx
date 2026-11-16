import { ContactForm } from "@/components/contact-form";
import { Card } from "@/components/ui";
import { getSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Contact support" };

export default async function ContactPage() {
  const [settings, user] = await Promise.all([getSettings(), getCurrentUser()]);
  return (
    <div className="container-page max-w-5xl py-12">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <h1 className="font-display text-3xl text-ink-900">Talk to us</h1>
          <p className="mt-2 text-sm leading-7 text-ink-500">
            Questions about a storefront, an order, or your subscription? Send a message and the {settings.platform_name} team
            will reply within one business day.
          </p>
          <div className="mt-6 space-y-3 text-sm text-ink-600">
            <p><span className="font-semibold text-ink-900">Email:</span> {settings.support_email}</p>
            <p><span className="font-semibold text-ink-900">Phone:</span> {settings.support_phone}</p>
            <p><span className="font-semibold text-ink-900">Hours:</span> Monday – Saturday, 8:00 – 18:00 WAT</p>
          </div>
          <div className="mt-6 rounded-xl border border-ink-100 bg-white p-4 text-sm text-ink-500">
            <p className="font-semibold text-ink-800">Reporting a problem with an order?</p>
            <p className="mt-1">Include your order reference so we can investigate quickly.</p>
          </div>
        </div>
        <Card className="card-pad">
          <ContactForm defaultEmail={user?.email} defaultName={user?.fullName} />
        </Card>
      </div>
    </div>
  );
}
