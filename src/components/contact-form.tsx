"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field } from "@/components/ui";
import { submitContactAction, type PublicState } from "@/app/actions/public";

export function ContactForm({ storeId, storeName, defaultEmail, defaultName }: { storeId?: string; storeName?: string; defaultEmail?: string; defaultName?: string }) {
  const [state, action] = useActionState<PublicState, FormData>(submitContactAction, {});
  return (
    <form action={action} className="space-y-4">
      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.message ? <Alert tone="success">{state.message}</Alert> : null}
      {storeId ? <input type="hidden" name="storeId" value={storeId} /> : null}
      <input type="hidden" name="category" value="support" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="senderName" error={state?.fieldErrors?.senderName} required>
          <input id="senderName" name="senderName" className="input" defaultValue={defaultName} required />
        </Field>
        <Field label="Email address" htmlFor="senderEmail" error={state?.fieldErrors?.senderEmail} required>
          <input id="senderEmail" name="senderEmail" type="email" className="input" defaultValue={defaultEmail} required />
        </Field>
      </div>
      <Field label="Subject" htmlFor="subject" error={state?.fieldErrors?.subject} required>
        <input id="subject" name="subject" className="input" defaultValue={storeName ? `Question about ${storeName}` : ""} required />
      </Field>
      <Field label="Message" htmlFor="body" error={state?.fieldErrors?.body} required>
        <textarea id="body" name="body" className="textarea" rows={5} required />
      </Field>
      <SubmitButton pendingLabel="Sending…">Send message</SubmitButton>
    </form>
  );
}
