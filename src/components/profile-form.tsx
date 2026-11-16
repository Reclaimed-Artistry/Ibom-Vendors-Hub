"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updateProfileAction, resendVerificationAction, type ActionState } from "@/app/actions/auth";
import { Alert, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function ProfileForm({ fullName, email, phone }: { fullName: string; email: string; phone: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(updateProfileAction, {});
  return (
    <form action={formAction} className="card-pad space-y-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}
      <Field label="Full name" htmlFor="fullName" required error={state.fieldErrors?.fullName}>
        <input id="fullName" name="fullName" className="input" defaultValue={fullName} required />
      </Field>
      <Field label="Email" htmlFor="email" hint="Contact support to change the email on your account.">
        <input id="email" className="input bg-ink-50" defaultValue={email} readOnly />
      </Field>
      <Field label="Phone" htmlFor="phone">
        <input id="phone" name="phone" className="input" defaultValue={phone} placeholder="+234…" />
      </Field>
      <Field label="New password" htmlFor="newPassword" hint="Leave blank to keep your current password.">
        <input id="newPassword" name="newPassword" type="password" className="input" minLength={8} autoComplete="new-password" />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SubmitButton className="btn-primary" pendingLabel="Saving…">Save changes</SubmitButton>
        <Link href="/forgot-password" className="text-xs font-semibold text-brand-700 hover:underline">Forgot your password?</Link>
      </div>
    </form>
  );
}

export function ResendVerificationForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(async () => resendVerificationAction(), {});
  return (
    <form action={formAction} className="space-y-2">
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.link ? (
        <p className="break-all text-xs text-ink-500">
          Dev link: <Link href={state.link} className="font-semibold text-brand-700 underline">{state.link}</Link>
        </p>
      ) : null}
      <SubmitButton className="btn-secondary btn-sm" pendingLabel="Sending…">Resend verification email</SubmitButton>
    </form>
  );
}
