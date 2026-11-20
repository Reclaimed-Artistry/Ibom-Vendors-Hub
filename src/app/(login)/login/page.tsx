import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-500.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/poppins/latin-700.css";
import "./login.css";
import { safeAuthNext } from "@/lib/auth-navigation";
import Link from "next/link";
import { LoginExperience } from "@/components/login-experience";
import { Alert } from "@/components/ui";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { getCurrentUser } from "@/lib/auth";
import { NO_INDEX } from "@/lib/seo";
import { redirect } from "next/navigation";

// Login has its own full-screen design, without changing the other auth pages.
export const metadata = { title: "Sign in", robots: NO_INDEX };

const demoMode = process.env.DEMO_MODE === "1";

const OAUTH_MESSAGES: Record<string, string> = {
  not_configured: "Google sign-in is not enabled on this deployment yet. Use your email and password.",
  cancelled: "Google sign-in was cancelled.",
  state: "That Google sign-in attempt expired. Please try again.",
  unverified: "Google did not confirm that email address, so no account was created.",
  suspended: "This account is not active. Please contact support.",
  failed: "Google sign-in could not be completed. Try again, or use your password.",
  client: "Google rejected this site's client secret. Copy the secret from the same OAuth client in Google Cloud Console and save it in Admin → Platform settings.",
  redirect: "That redirect URI is not authorised on the Google OAuth client. Add the exact callback URL shown in Admin → Platform settings.",
  code: "That Google sign-in link has already been used or expired. Start again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; registered?: string; oauth?: string }>;
}) {
  const params = await searchParams;
  const next = safeAuthNext(params.next) ?? undefined;
  const user = await getCurrentUser();
  if (user) {
    if (next) redirect(next);
    redirect(user.role === "vendor" ? "/vendor" : user.role === "customer" ? "/account" : "/admin");
  }

  const isCheckoutRedirect = Boolean(next && /^\/checkout(?:[/?#]|$)/.test(next));
  const notices = (
    <>
      {isCheckoutRedirect ? (
        <Alert tone="info">
          Your cart items are saved on this device. Sign in below or{" "}
          <Link href={`/register/customer?next=${encodeURIComponent(next ?? "/checkout")}`} className="font-semibold underline">
            create an account
          </Link>{" "}
          to complete your order.
        </Alert>
      ) : null}
      {params.reset ? <Alert tone="success">Password updated. Sign in with your new password.</Alert> : null}
      {params.oauth ? <Alert tone="warning">{OAUTH_MESSAGES[params.oauth] ?? OAUTH_MESSAGES.failed}</Alert> : null}
    </>
  );

  return (
    <LoginExperience
      next={next}
      heading={isCheckoutRedirect ? "Sign in to continue to checkout" : "Welcome back"}
      subtitle={isCheckoutRedirect
        ? "Sign in to keep your order, Delivery PIN, and verified purchase reviews tied to your account."
        : "Sign in to manage your store or track your orders."}
      notices={notices}
      googleLogin={<GoogleAuthButton next={next} />}
      googleSignup={<GoogleAuthButton label="Sign up with Google" next={next} />}
      demoAccounts={demoMode ? (
        <>
          <p className="font-semibold">Demo accounts (seeded database only)</p>
          <p>Vendor: grace@mamaput.test · Vendor1234!</p>
          <p>Customer: customer@ibomvendorshub.com · Customer1234!</p>
          <p>Admin: admin@ibomvendorshub.com · Admin1234!</p>
        </>
      ) : undefined}
    />
  );
}
