import Link from "next/link";
import { LoginForm } from "@/components/auth-forms";
import { Alert } from "@/components/ui";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Sign in" };

// Seeded demo logins only make sense against a database that still holds the seed
// data, so the hint is opt-in through DEMO_MODE=1 (never set in production).
const demoMode = process.env.DEMO_MODE === "1";

const OAUTH_MESSAGES: Record<string, string> = {
  not_configured: "Google sign-in is not enabled on this deployment yet. Use your email and password.",
  cancelled: "Google sign-in was cancelled.",
  state: "That Google sign-in attempt expired. Please try again.",
  unverified: "Google did not confirm that email address, so no account was created.",
  suspended: "This account is not active. Please contact support.",
  failed: "Google sign-in could not be completed. Try again, or use your password.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; registered?: string; oauth?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(user.role === "vendor" ? "/vendor" : user.role === "customer" ? "/account" : "/admin");

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
      <p className="mt-1.5 text-sm text-ink-500">Sign in to manage your store or track your orders.</p>
      {params.reset ? <div className="mt-5"><Alert tone="success">Password updated. Sign in with your new password.</Alert></div> : null}
      {params.oauth ? <div className="mt-5"><Alert tone="warning">{OAUTH_MESSAGES[params.oauth] ?? OAUTH_MESSAGES.failed}</Alert></div> : null}
      <div className="mt-6 space-y-5">
        <GoogleAuthButton next={params.next} />
        <LoginForm next={params.next} />
      </div>
      {demoMode ? (
        <div className="mt-8 grid gap-2 rounded-xl border border-ink-100 bg-white p-4 text-xs text-ink-500">
          <p className="font-semibold text-ink-700">Demo accounts (seeded database only)</p>
          <p>Vendor: grace@mamaput.test · Vendor1234!</p>
          <p>Customer: customer@ibomvendorshub.com · Customer1234!</p>
          <p>Admin: admin@ibomvendorshub.com · Admin1234!</p>
        </div>
      ) : null}
      <p className="mt-6 text-sm text-ink-500">
        New to Ibom Vendors Hub? <Link href="/register" className="font-semibold text-brand-800 hover:text-brand-900">Open a storefront</Link>
      </p>
    </div>
  );
}
