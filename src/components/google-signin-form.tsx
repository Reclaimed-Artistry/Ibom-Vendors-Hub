"use client";

import { useActionState } from "react";
import { saveGoogleSignInAction } from "@/app/actions/admin";
import type { AdminState } from "@/app/actions/admin";
import { Alert, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

function GoogleStateNote({ state }: { state: AdminState }) {
  if (state.error) return <Alert tone="danger">{state.error}</Alert>;
  if (state.message) return <Alert tone="success">{state.message}</Alert>;
  return null;
}

/**
 * Credentials for "Continue with Google".
 *
 * Nothing secret is echoed back: a stored secret shows as an empty password
 * field with a "stored" hint, and leaving it blank keeps what is already there.
 */
export function GoogleSignInForm({
  savedClientId,
  hasSecret,
  enabled,
  redirectUri,
}: {
  savedClientId: string;
  hasSecret: boolean;
  enabled: boolean;
  redirectUri: string;
}) {
  const [state, formAction] = useActionState<AdminState, FormData>(saveGoogleSignInAction, {});
  return (
    <form action={formAction} className="space-y-3">
      <GoogleStateNote state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Client ID"
          htmlFor="googleClientId"
          hint="Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application). Blank keeps your existing ID; use the switch to disable sign-in."
        >
          <input
            id="googleClientId"
            name="clientId"
            className="input font-mono text-xs"
            placeholder="1234567890-abc123.apps.googleusercontent.com"
            defaultValue={savedClientId}
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
        <Field
          label="Client secret"
          htmlFor="googleClientSecret"
          hint={hasSecret ? "A secret is already stored — leave blank to keep it." : "Copy it from the same OAuth client."}
        >
          <input
            id="googleClientSecret"
            name="clientSecret"
            type="password"
            className="input font-mono text-xs"
            placeholder={hasSecret ? "•••••••• already stored" : "GOCSPX-…"}
            autoComplete="new-password"
          />
        </Field>
      </div>
      <div className="rounded-xl border border-ink-100 p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Authorised redirect URI</p>
        <code className="mt-1 block break-all rounded-lg bg-ink-50 px-2.5 py-2 text-xs text-ink-700">{redirectUri}</code>
        <p className="mt-1.5 text-xs text-ink-400">
          Paste that exact value into the OAuth client. Add the same URI for every custom domain you serve.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" name="enabled" defaultChecked={enabled} className="size-4 rounded border-ink-300" />
          Show “Continue with Google”
        </label>
        <SubmitButton className="btn-primary" pendingLabel="Saving…">
          Save Google sign-in
        </SubmitButton>
      </div>
      <p className="text-xs text-ink-400">
        Clear the client ID and save to disconnect. New Google accounts are created as customers; existing emails sign
        into the account that owns them, and suspended accounts are refused.
      </p>
    </form>
  );
}
