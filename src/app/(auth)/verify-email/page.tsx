import Link from "next/link";
import { VerifyEmailForm } from "@/components/auth-forms";
import { Alert } from "@/components/ui";

export const metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Verify your email address</h1>
      <p className="mt-1.5 text-sm text-ink-500">
        Confirming your email secures your account and makes sure order notifications reach you.
      </p>
      <div className="mt-6">
        {token ? (
          <VerifyEmailForm token={token} />
        ) : (
          <Alert tone="warning" title="No verification token">
            Open the link from your verification email. <Link href="/login" className="font-semibold underline">Return to sign in</Link>
          </Alert>
        )}
      </div>
    </div>
  );
}
