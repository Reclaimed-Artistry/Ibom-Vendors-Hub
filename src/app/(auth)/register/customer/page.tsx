import Link from "next/link";
import { redirect } from "next/navigation";
import { CustomerRegisterForm } from "@/components/auth-forms";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Create Account" };

export default async function CustomerRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (user) {
    if (params.next && params.next.startsWith("/")) redirect(params.next);
    redirect(user.role === "vendor" ? "/vendor" : user.role === "customer" ? "/account" : "/admin");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
      <p className="mt-1.5 text-sm text-ink-500">
        Sign up with Google or email to shop, track orders, and unlock verified options in your account dashboard.
      </p>
      <div className="mt-6 space-y-5">
        <GoogleAuthButton label="Sign up with Google" next={params.next} />
        <CustomerRegisterForm next={params.next} />
      </div>
      <p className="mt-6 text-sm text-ink-500">
        Already have an account?{" "}
        <Link
          href={params.next ? `/login?next=${encodeURIComponent(params.next)}` : "/login"}
          className="font-semibold text-brand-800 hover:text-brand-900"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
