"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field } from "@/components/ui";
import type { ActionState } from "@/app/actions/auth";
import { forgotPasswordAction, loginAction, registerCustomerAction, registerVendorAction, resetPasswordAction, verifyEmailAction } from "@/app/actions/auth";

const initial: ActionState = {};
type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

function Feedback({ state }: { state: ActionState }) {
  if (!state) return null;
  return (
    <div className="space-y-3">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.message ? (
        <Alert tone="success" title="Done">
          {state.message}
          {state.link ? (
            <a href={state.link} className="mt-2 flex items-center gap-1 break-all font-semibold underline">
              Open link <ExternalLink className="size-3" />
            </a>
          ) : null}
        </Alert>
      ) : null}
      {state.link && !state.message ? (
        <Alert tone="info" title="Development email link">
          <a href={state.link} className="break-all underline">{state.link}</a>
        </Alert>
      ) : null}
    </div>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(loginAction as Action, initial);
  return (
    <form action={action} className="space-y-4">
      <Feedback state={state} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="Email address" htmlFor="email" error={state?.fieldErrors?.email} required>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" placeholder="you@business.com" />
      </Field>
      <Field label="Password" htmlFor="password" error={state?.fieldErrors?.password} required>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" placeholder="••••••••" />
      </Field>
      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="font-medium text-brand-800 hover:text-brand-900">Forgot password?</Link>
        <Link href="/register/customer" className="text-ink-500 hover:text-ink-800">Create customer account</Link>
      </div>
      <SubmitButton className="w-full" pendingLabel="Signing in…">Sign in</SubmitButton>
    </form>
  );
}

export function VendorRegisterForm({ categories }: { categories: Array<{ slug: string; name: string }> }) {
  const [state, action] = useActionState<ActionState, FormData>(registerVendorAction as Action, initial);
  return (
    <form action={action} className="space-y-4">
      <Feedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name" htmlFor="businessName" error={state?.fieldErrors?.businessName} required hint="We build your store address from this name">
          <input id="businessName" name="businessName" className="input" required placeholder="Royal Fashion Boutique" />
        </Field>
        <Field label="Your full name" htmlFor="ownerName" error={state?.fieldErrors?.ownerName} required>
          <input id="ownerName" name="ownerName" className="input" required placeholder="Imaobong Udo" />
        </Field>
        <Field label="Email address" htmlFor="email" error={state?.fieldErrors?.email} required>
          <input id="email" name="email" type="email" className="input" required placeholder="you@business.com" />
        </Field>
        <Field label="Phone number" htmlFor="phone" error={state?.fieldErrors?.phone} required>
          <input id="phone" name="phone" className="input" required placeholder="0803 123 4567" />
        </Field>
      </div>
      <Field label="Business category" htmlFor="categorySlug" error={state?.fieldErrors?.categorySlug} required hint="Your dashboard and ordering workflow adapt to this category">
        <select id="categorySlug" name="categorySlug" className="select" required defaultValue="">
          <option value="" disabled>Select a category</option>
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>{category.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Business description" htmlFor="description" error={state?.fieldErrors?.description} required>
        <textarea id="description" name="description" className="textarea" required placeholder="Tell customers what you sell, how you work and where you are based." />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="City" htmlFor="city" error={state?.fieldErrors?.city} required>
          <input id="city" name="city" className="input" required placeholder="Uyo" />
        </Field>
        <Field label="State" htmlFor="state" error={state?.fieldErrors?.state} required>
          <input id="state" name="state" className="input" required defaultValue="Akwa Ibom" />
        </Field>
        <Field label="Street address" htmlFor="address" error={state?.fieldErrors?.address}>
          <input id="address" name="address" className="input" placeholder="12 Aba Road" />
        </Field>
      </div>
      <Field label="Password" htmlFor="password" error={state?.fieldErrors?.password} required hint="At least 8 characters with a letter and a number">
        <input id="password" name="password" type="password" className="input" required autoComplete="new-password" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business logo" htmlFor="logoFile" hint="Square image, max 6MB">
          <input id="logoFile" name="logoFile" type="file" accept="image/*" className="input file:mr-3 file:rounded-lg file:border-0 file:bg-ink-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold" />
        </Field>
        <Field label="Cover image" htmlFor="coverFile" hint="Landscape image for your storefront banner">
          <input id="coverFile" name="coverFile" type="file" accept="image/*" className="input file:mr-3 file:rounded-lg file:border-0 file:bg-ink-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold" />
        </Field>
      </div>
      <label className="flex items-start gap-2 text-sm text-ink-600">
        <input type="checkbox" name="acceptTerms" className="mt-0.5 size-4" required />
        <span>
          I agree to the <Link href="/terms" className="font-semibold text-brand-800 underline">terms of service</Link> and confirm
          that the information provided is accurate.
        </span>
      </label>
      {state?.fieldErrors?.acceptTerms ? <p className="error-text">{state.fieldErrors.acceptTerms}</p> : null}
      <SubmitButton className="w-full" pendingLabel="Creating your storefront…">Create my storefront</SubmitButton>
    </form>
  );
}

export function CustomerRegisterForm() {
  const [state, action] = useActionState<ActionState, FormData>(registerCustomerAction as Action, initial);
  return (
    <form action={action} className="space-y-4">
      <Feedback state={state} />
      <Field label="Full name" htmlFor="fullName" error={state?.fieldErrors?.fullName} required>
        <input id="fullName" name="fullName" className="input" required placeholder="Ada Bassey" />
      </Field>
      <Field label="Email address" htmlFor="email" error={state?.fieldErrors?.email} required>
        <input id="email" name="email" type="email" className="input" required />
      </Field>
      <Field label="Phone number" htmlFor="phone" error={state?.fieldErrors?.phone} hint="Optional, used for delivery updates">
        <input id="phone" name="phone" className="input" placeholder="0812 345 6789" />
      </Field>
      <Field label="Password" htmlFor="password" error={state?.fieldErrors?.password} required>
        <input id="password" name="password" type="password" className="input" required autoComplete="new-password" />
      </Field>
      <label className="flex items-start gap-2 text-sm text-ink-600">
        <input type="checkbox" name="acceptTerms" className="mt-0.5 size-4" required />
        <span>
          I agree to the <Link href="/terms" className="font-semibold text-brand-800 underline">terms of service</Link>.
        </span>
      </label>
      {state?.fieldErrors?.acceptTerms ? <p className="error-text">{state.fieldErrors.acceptTerms}</p> : null}
      <SubmitButton className="w-full" pendingLabel="Creating account…">Create account</SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState<ActionState, FormData>(forgotPasswordAction as Action, initial);
  return (
    <form action={action} className="space-y-4">
      <Feedback state={state} />
      <Field label="Email address" htmlFor="email" required>
        <input id="email" name="email" type="email" className="input" required />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Sending…">Send reset link</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState<ActionState, FormData>(resetPasswordAction as Action, initial);
  return (
    <form action={action} className="space-y-4">
      <Feedback state={state} />
      <input type="hidden" name="token" value={token} />
      <Field label="New password" htmlFor="password" error={state?.fieldErrors?.password} required>
        <input id="password" name="password" type="password" className="input" required autoComplete="new-password" />
      </Field>
      <Field label="Confirm new password" htmlFor="confirmPassword" error={state?.fieldErrors?.confirmPassword} required>
        <input id="confirmPassword" name="confirmPassword" type="password" className="input" required autoComplete="new-password" />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Updating…">Update password</SubmitButton>
    </form>
  );
}

export function VerifyEmailForm({ token }: { token: string }) {
  const [state, action] = useActionState<ActionState, FormData>(verifyEmailAction as Action, initial);
  return (
    <form action={action} className="space-y-4">
      <Feedback state={state} />
      {state?.message ? (
        <p className="flex items-center gap-2 text-sm text-brand-800"><CheckCircle2 className="size-4" /> You can now continue to your dashboard.</p>
      ) : (
        <>
          <input type="hidden" name="token" value={token} />
          <SubmitButton className="w-full" pendingLabel="Verifying…">Confirm my email address</SubmitButton>
        </>
      )}
    </form>
  );
}
