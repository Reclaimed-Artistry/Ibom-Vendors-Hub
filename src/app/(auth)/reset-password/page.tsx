import { ResetPasswordForm } from "@/components/auth-forms";
import { Alert } from "@/components/ui";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
      <p className="mt-1.5 text-sm text-ink-500">Use a strong password you don&apos;t use elsewhere.</p>
      <div className="mt-6">
        {token ? <ResetPasswordForm token={token} /> : <Alert tone="danger">This reset link is missing its token. Request a new link.</Alert>}
      </div>
    </div>
  );
}
