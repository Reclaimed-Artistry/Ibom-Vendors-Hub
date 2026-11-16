"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { CheckCircle2, FileCheck2, MapPin, ShieldCheck } from "lucide-react";
import {
  ActionState,
  forgotPasswordAction,
  loginAction,
  registerCustomerAction,
  registerVendorAction,
  resetPasswordAction,
  verifyEmailAction,
} from "@/app/actions/auth";
import { AKWA_IBOM_LGAS, AKWA_IBOM_STATE, PROOF_OF_RESIDENCE_TYPES } from "@/lib/akwa-ibom";
import { Alert, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import type { StoreCategory } from "@/lib/types";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;
const initial: ActionState = {};

function Feedback({ state }: { state: ActionState }) {
  if (state?.error) return <Alert tone="danger">{state.error}</Alert>;
  if (state?.message) return <Alert tone="success">{state.message}</Alert>;
  return null;
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(loginAction as Action, initial);
  return (
    <form action={action} className="space-y-4">
      <Feedback state={state} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="Email address" htmlFor="email" error={state?.fieldErrors?.email} required>
        <input id="email" name="email" type="email" className="input" required autoComplete="email" placeholder="you@business.com" />
      </Field>
      <Field label="Password" htmlFor="password" error={state?.fieldErrors?.password} required>
        <input id="password" name="password" type="password" className="input" required autoComplete="current-password" />
      </Field>
      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="font-medium text-brand-800 hover:text-brand-900">
          Forgot password?
        </Link>
      </div>
      <SubmitButton className="w-full" pendingLabel="Signing in…">Sign in</SubmitButton>
    </form>
  );
}

export function VendorRegisterForm({
  categories,
  rootDomain,
}: {
  categories: StoreCategory[];
  rootDomain: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(registerVendorAction as Action, initial);
  const [businessName, setBusinessName] = useState("");
  const [cacRegistered, setCacRegistered] = useState<"yes" | "no">("no");
  const [proofFileName, setProofFileName] = useState<string>("");
  const [check, setCheck] = useState<{ available: boolean; slug: string; reason?: string } | null>(null);

  useEffect(() => {
    const trimmed = businessName.trim();
    if (trimmed.length < 3) {
      setCheck(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/subdomain-check?name=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        setCheck(data);
      } catch {
        setCheck(null);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [businessName]);

  return (
    <form action={action} className="space-y-4">
      <Feedback state={state} />

      <div className="flex items-start gap-2.5 rounded-xl border border-brand-200 bg-brand-50/70 px-3.5 py-2.5 text-xs text-brand-900">
        <MapPin className="mt-0.5 size-4 shrink-0 text-brand-700" />
        <div>
          <p className="font-semibold">Akwa Ibom State Vendors Only</p>
          <p className="text-brand-800/90">
            Every storefront on Ibom Vendors Hub is verified to operate within <strong>Akwa Ibom State</strong>.
          </p>
        </div>
      </div>

      <Field
        label="Business name"
        htmlFor="businessName"
        error={state?.fieldErrors?.businessName}
        hint={
          check
            ? check.available
              ? `Your storefront address: ${check.slug}.${rootDomain}`
              : check.reason
            : "This also sets your subdomain (e.g. mamaputkitchen." + rootDomain + ")"
        }
        required
      >
        <input
          id="businessName"
          name="businessName"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          className="input"
          required
          placeholder="e.g. Mama Put Kitchen"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Owner full name" htmlFor="ownerName" error={state?.fieldErrors?.ownerName} required>
          <input id="ownerName" name="ownerName" className="input" required placeholder="Grace Etim" />
        </Field>
        <Field label="Phone / WhatsApp" htmlFor="phone" error={state?.fieldErrors?.phone} required>
          <input id="phone" name="phone" className="input" required placeholder="0803 123 4567" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business email" htmlFor="email" error={state?.fieldErrors?.email} required>
          <input id="email" name="email" type="email" className="input" required autoComplete="email" />
        </Field>
        <Field label="Password" htmlFor="password" error={state?.fieldErrors?.password} hint="Min 8 characters, letters & numbers" required>
          <input id="password" name="password" type="password" className="input" required autoComplete="new-password" />
        </Field>
      </div>

      <Field label="Business category" htmlFor="categorySlug" error={state?.fieldErrors?.categorySlug} required>
        <select id="categorySlug" name="categorySlug" className="select" required defaultValue="">
          <option value="" disabled>Choose what best describes your business…</option>
          {categories.map((cat) => (
            <option key={cat.slug} value={cat.slug}>{cat.name}</option>
          ))}
        </select>
      </Field>

      <Field label="About your business" htmlFor="description" error={state?.fieldErrors?.description} required>
        <textarea id="description" name="description" rows={3} className="textarea" required placeholder="Tell customers what you sell, make or offer…" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="LGA / Town in Akwa Ibom" htmlFor="city" error={state?.fieldErrors?.city} required>
          <select id="city" name="city" className="select" required defaultValue="Uyo">
            {AKWA_IBOM_LGAS.map((lga) => (
              <option key={lga} value={lga}>{lga}</option>
            ))}
          </select>
        </Field>
        <Field label="State" htmlFor="state" error={state?.fieldErrors?.state} hint="Locked to Akwa Ibom State" required>
          <input
            id="state"
            name="state"
            value={AKWA_IBOM_STATE}
            readOnly
            className="input bg-ink-50 font-semibold text-ink-800 cursor-not-allowed"
          />
        </Field>
      </div>

      <Field
        label="Physical business / pickup street address (Akwa Ibom)"
        htmlFor="address"
        error={state?.fieldErrors?.address}
        hint="Customers who choose 'Pick up from vendor's location' at checkout will see this address"
        required
      >
        <input
          id="address"
          name="address"
          className="input"
          required
          placeholder="e.g. 12 Aba Road, beside Ibom Plaza, Uyo"
        />
      </Field>

      {/* KYC: NIN, Proof of Residence, CAC */}
      <div className="space-y-4 rounded-2xl border border-ink-200 bg-ink-50/50 p-4">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-700" />
          <div>
            <h3 className="text-sm font-semibold text-ink-900">Identity, Residence & CAC Verification</h3>
            <p className="text-xs text-ink-500">
              Used by Ibom Vendors Hub to verify every merchant and protect customers across Akwa Ibom. Kept strictly confidential.
            </p>
          </div>
        </div>

        <Field
          label="National Identification Number (NIN)"
          htmlFor="nin"
          error={state?.fieldErrors?.nin}
          hint="11-digit NIN linked to the business owner"
          required
        >
          <input
            id="nin"
            name="nin"
            inputMode="numeric"
            pattern="\d{11}"
            maxLength={11}
            className="input font-mono tracking-wider"
            required
            placeholder="12345678901"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Proof of residence type"
            htmlFor="proofOfResidenceType"
            error={state?.fieldErrors?.proofOfResidenceType}
            required
          >
            <select id="proofOfResidenceType" name="proofOfResidenceType" className="select" required defaultValue="utility_bill">
              {PROOF_OF_RESIDENCE_TYPES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </Field>

          <Field
            label="Upload proof of residence"
            htmlFor="proofOfResidenceFile"
            error={state?.fieldErrors?.proofOfResidenceUrl}
            hint={proofFileName ? `Selected: ${proofFileName}` : "JPG, PNG, WEBP or PDF (max 6MB)"}
            required
          >
            <input
              id="proofOfResidenceFile"
              name="proofOfResidenceFile"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              required
              onChange={(e) => setProofFileName(e.target.files?.[0]?.name ?? "")}
              className="input py-1.5 text-xs"
            />
          </Field>
        </div>

        <div className="space-y-2.5">
          <p className="text-sm font-medium text-ink-800">
            Is your business registered with CAC (Corporate Affairs Commission)? <span className="text-red-600">*</span>
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <label
              className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-sm transition ${
                cacRegistered === "yes" ? "border-brand-600 bg-white ring-1 ring-brand-600" : "border-ink-200 bg-white"
              }`}
            >
              <input
                type="radio"
                name="cacRegistered"
                value="yes"
                checked={cacRegistered === "yes"}
                onChange={() => setCacRegistered("yes")}
                className="mt-0.5"
              />
              <div>
                <p className="font-semibold text-ink-900">Yes, registered with CAC</p>
                <p className="text-xs text-ink-500">Provide your RC, BN, or IT number</p>
              </div>
            </label>
            <label
              className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-sm transition ${
                cacRegistered === "no" ? "border-brand-600 bg-white ring-1 ring-brand-600" : "border-ink-200 bg-white"
              }`}
            >
              <input
                type="radio"
                name="cacRegistered"
                value="no"
                checked={cacRegistered === "no"}
                onChange={() => setCacRegistered("no")}
                className="mt-0.5"
              />
              <div>
                <p className="font-semibold text-ink-900">No, not registered yet</p>
                <p className="text-xs text-ink-500">Proceed with NIN & Proof of Residence</p>
              </div>
            </label>
          </div>
          {state?.fieldErrors?.cacRegistered ? (
            <p className="error-text">{state.fieldErrors.cacRegistered}</p>
          ) : null}
        </div>

        {cacRegistered === "yes" ? (
          <Field
            label="CAC registration number"
            htmlFor="cacNumber"
            error={state?.fieldErrors?.cacNumber}
            hint="Enter your Business Name (BN) or Company (RC) registration number"
            required
          >
            <input
              id="cacNumber"
              name="cacNumber"
              className="input font-mono uppercase"
              required
              placeholder="e.g. BN-3482910 or RC-1928374"
            />
          </Field>
        ) : (
          <p className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs text-ink-600 border border-ink-100">
            <FileCheck2 className="size-4 shrink-0 text-brand-700" />
            Unregistered Akwa Ibom businesses and artisans are welcome — you can add a CAC number later in Store Settings.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business logo" htmlFor="logoFile" hint="Square image, optional">
          <input id="logoFile" name="logoFile" type="file" accept="image/*" className="input py-1.5 text-xs" />
        </Field>
        <Field label="Cover banner" htmlFor="coverFile" hint="Wide image, optional">
          <input id="coverFile" name="coverFile" type="file" accept="image/*" className="input py-1.5 text-xs" />
        </Field>
      </div>

      <label className="flex items-start gap-2 text-sm text-ink-600">
        <input type="checkbox" name="acceptTerms" className="mt-0.5 size-4 rounded border-ink-300 text-brand-700" required />
        <span>
          I confirm this business operates in <strong>Akwa Ibom State</strong> and agree to the{" "}
          <Link href="/terms" className="font-semibold text-brand-800 underline">terms of service</Link> and{" "}
          <Link href="/privacy" className="font-semibold text-brand-800 underline">privacy policy</Link>.
        </span>
      </label>
      {state?.fieldErrors?.acceptTerms ? <p className="error-text">{state.fieldErrors.acceptTerms}</p> : null}

      <SubmitButton className="w-full" pendingLabel="Creating your storefront…">
        Create my storefront
      </SubmitButton>
    </form>
  );
}

export function CustomerRegisterForm({ next }: { next?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(registerCustomerAction as Action, initial);
  return (
    <form action={action} className="space-y-4">
      <Feedback state={state} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="Full name" htmlFor="fullName" error={state?.fieldErrors?.fullName} required>
        <input id="fullName" name="fullName" className="input" required />
      </Field>
      <Field label="Email address" htmlFor="email" error={state?.fieldErrors?.email} required>
        <input id="email" name="email" type="email" className="input" required autoComplete="email" />
      </Field>
      <Field label="Phone number" htmlFor="phone" error={state?.fieldErrors?.phone} required>
        <input id="phone" name="phone" className="input" required placeholder="0803 123 4567" />
      </Field>
      <Field label="Password" htmlFor="password" error={state?.fieldErrors?.password} hint="Min 8 characters, letters & numbers" required>
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
