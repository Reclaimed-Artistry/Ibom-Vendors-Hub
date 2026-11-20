import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth-forms";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Forgot your password?</h1>
      <p className="mt-1.5 text-sm text-ink-500">Enter your email and we&apos;ll send a secure reset link.</p>
      <div className="mt-6"><ForgotPasswordForm /></div>
      <p className="mt-6 text-sm text-ink-500">
        <Link href="/login" className="font-semibold text-brand-800 hover:text-brand-900">Back to sign in</Link>
      </p>
    </div>
  );
}
