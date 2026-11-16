"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { CheckCircle2, ClipboardCheck, Eye, EyeOff, FileCheck2, Landmark, Loader2, Lock, MapPin, ShieldCheck } from "lucide-react";
import {
  ActionState,
  forgotPasswordAction,
  loginAction,
  registerCustomerAction,
  registerVendorAction,
  resetPasswordAction,
  verifyEmailAction,
} from "@/app/actions/auth";
import { AKWA_IBOM_LGAS, AKWA_IBOM_STATE, NIGERIAN_BANKS, PROOF_OF_RESIDENCE_TYPES } from "@/lib/akwa-ibom";
import { getCategoryBookingProfile, isArtisanCategorySlug } from "@/lib/artisan-bookings";
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

/** Compress large camera photos (> 1.2 MB) in-browser so uploads are fast and stay well below serverless limits. */
async function compressImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml" || file.size <= 1_200_000) {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const maxDim = 1800;
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.84),
    );
    if (!blob || blob.size >= file.size) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "") || "upload";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

async function preUploadFile(file: File, kind: "kyc" | "logo" | "cover"): Promise<string> {
  const prepared = await compressImageIfNeeded(file);
  const body = new FormData();
  body.set("file", prepared);
  body.set("kind", kind);
  const res = await fetch("/api/register-upload", { method: "POST", body });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) {
    throw new Error(data.error || "Could not upload file");
  }
  return data.url;
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(loginAction as Action, initial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <Feedback state={state} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="Email address" htmlFor="email" error={state?.fieldErrors?.email} required>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
          required
          autoComplete="email"
          placeholder="you@business.com"
        />
      </Field>
      <Field label="Password" htmlFor="password" error={state?.fieldErrors?.password} required>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input pr-10"
            required
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-400 hover:text-ink-700"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
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

export interface VendorInitialUser {
  fullName?: string;
  email?: string;
  phone?: string | null;
}

export function VendorRegisterForm({
  categories,
  rootDomain,
  initialUser,
}: {
  categories: StoreCategory[];
  rootDomain: string;
  initialUser?: VendorInitialUser;
}) {
  const [state, action] = useActionState<ActionState, FormData>(registerVendorAction as Action, initial);
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState(initialUser?.fullName ?? "");
  const [phone, setPhone] = useState(initialUser?.phone ?? "");
  const [categorySlug, setCategorySlug] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("Uyo");
  const [address, setAddress] = useState("");
  const [nin, setNin] = useState("");
  const [proofOfResidenceType, setProofOfResidenceType] = useState("utility_bill");
  const [cacRegistered, setCacRegistered] = useState<"yes" | "no">("no");
  const [cacNumber, setCacNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState(initialUser?.fullName ?? "");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [proofFileName, setProofFileName] = useState("");
  const [proofOfResidenceUrl, setProofOfResidenceUrl] = useState("");
  const [proofUploading, setProofUploading] = useState(false);
  const [proofUploadError, setProofUploadError] = useState("");

  const [logoUrl, setLogoUrl] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [coverUrl, setCoverUrl] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);

  const [checkingName, setCheckingName] = useState(false);
  const [check, setCheck] = useState<{
    available: boolean;
    locked?: boolean;
    slug: string;
    suggestedSlug?: string;
    reason?: string;
  } | null>(null);

  useEffect(() => {
    const trimmed = businessName.trim();
    if (trimmed.length < 2) {
      setCheck(null);
      setCheckingName(false);
      return;
    }
    setCheckingName(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/subdomain-check?name=${encodeURIComponent(trimmed)}&city=${encodeURIComponent(city)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        setCheck(data);
      } catch {
        setCheck(null);
      } finally {
        setCheckingName(false);
      }
    }, 240);
    return () => clearTimeout(timer);
  }, [businessName, city]);

  const anyUploading = proofUploading || logoUploading || coverUploading;
  const isNameLocked = Boolean(check && !check.available);

  return (
    <form action={action} className="space-y-4">
      <Feedback state={state} />

      <input type="hidden" name="proofOfResidenceUrl" value={proofOfResidenceUrl} />
      <input type="hidden" name="logoUrl" value={logoUrl} />
      <input type="hidden" name="coverUrl" value={coverUrl} />
      <input type="hidden" name="email" value={initialUser?.email ?? ""} />

      {initialUser?.email ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs text-emerald-950">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-700" />
            <span>
              Creating storefront under verified account <strong>{initialUser.email}</strong>
            </span>
          </div>
        </div>
      ) : null}

      <div className="flex items-start gap-2.5 rounded-xl border border-brand-200 bg-brand-50/70 px-3.5 py-2.5 text-xs text-brand-900">
        <MapPin className="mt-0.5 size-4 shrink-0 text-brand-700" />
        <div>
          <p className="font-semibold">Akwa Ibom State Vendors Only</p>
          <p className="text-brand-800/90">
            Every storefront on Ibom Vendors Hub is verified to operate within <strong>Akwa Ibom State</strong> and has a globally unique business name.
          </p>
        </div>
      </div>

      <Field
        label="Unique business name"
        htmlFor="businessName"
        error={isNameLocked ? (check?.reason ?? "That business name is already in use and locked.") : state?.fieldErrors?.businessName}
        hint={
          checkingName
            ? "Checking business name availability…"
            : check?.available
              ? `✓ Unique name available — storefront address: ${check.slug}.${rootDomain}`
              : !check
                ? `Every vendor business name is locked uniquely (e.g. mamaputkitchen.${rootDomain})`
                : undefined
        }
        required
      >
        <input
          id="businessName"
          name="businessName"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          className={`input ${isNameLocked ? "border-red-400 bg-red-50/30 focus:border-red-500 focus:ring-red-500/20" : ""}`}
          required
          minLength={3}
          placeholder="e.g. Mama Put Kitchen"
        />
        {isNameLocked ? (
          <div className="mt-2 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
            <Lock className="mt-0.5 size-3.5 shrink-0 text-red-600" />
            <span>
              {check?.reason ?? "That business name is already in use and locked by another vendor. Choose a different business name."}
            </span>
          </div>
        ) : null}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Owner full name" htmlFor="ownerName" error={state?.fieldErrors?.ownerName} required>
          <input
            id="ownerName"
            name="ownerName"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            className="input"
            required
            placeholder="Grace Etim"
          />
        </Field>
        <Field label="Phone / WhatsApp" htmlFor="phone" error={state?.fieldErrors?.phone} required>
          <input
            id="phone"
            name="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input"
            required
            placeholder="0803 123 4567"
          />
        </Field>
      </div>

      <Field label="Business or artisan category" htmlFor="categorySlug" error={state?.fieldErrors?.categorySlug} required>
        <select
          id="categorySlug"
          name="categorySlug"
          className="select"
          required
          value={categorySlug}
          onChange={(e) => setCategorySlug(e.target.value)}
        >
          <option value="" disabled>Choose what best describes your business or trade…</option>
          <optgroup label="Nigerian Artisans & Technical Trades">
            {categories.filter((cat) => isArtisanCategorySlug(cat.slug)).map((cat) => (
              <option key={cat.slug} value={cat.slug}>{cat.name}</option>
            ))}
          </optgroup>
          <optgroup label="Retail, Food, Fashion & Professional Services">
            {categories.filter((cat) => !isArtisanCategorySlug(cat.slug)).map((cat) => (
              <option key={cat.slug} value={cat.slug}>{cat.name}</option>
            ))}
          </optgroup>
        </select>
      </Field>

      {isArtisanCategorySlug(categorySlug) ? (() => {
        const artisanProfile = getCategoryBookingProfile(categorySlug);
        return (
          <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-4">
            <div className="flex items-start gap-2.5">
              <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-brand-700" />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-brand-900">
                  Built-in {artisanProfile.requirementsTitle}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {artisanProfile.tradesCovered.map((trade) => (
                    <span key={trade} className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-brand-900 ring-1 ring-brand-200">
                      {trade}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-brand-800">
                  Your storefront will automatically display and collect these service booking requirements from customers:
                </p>
                <ul className="space-y-1 text-xs leading-5 text-ink-800">
                  {artisanProfile.requirements.map((req, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-brand-700" />
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        );
      })() : null}

      <Field
        label="About your business"
        htmlFor="description"
        error={state?.fieldErrors?.description}
        hint="Briefly describe your products or services (at least 10 characters)"
        required
      >
        <textarea
          id="description"
          name="description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="textarea"
          required
          placeholder="Tell customers what you sell, make or offer…"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="LGA / Town in Akwa Ibom" htmlFor="city" error={state?.fieldErrors?.city} required>
          <select
            id="city"
            name="city"
            className="select"
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
          >
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
          value={address}
          onChange={(e) => setAddress(e.target.value)}
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
            maxLength={14}
            value={nin}
            onChange={(e) => setNin(e.target.value.replace(/[^\d\s-]/g, ""))}
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
            <select
              id="proofOfResidenceType"
              name="proofOfResidenceType"
              className="select"
              required
              value={proofOfResidenceType}
              onChange={(e) => setProofOfResidenceType(e.target.value)}
            >
              {PROOF_OF_RESIDENCE_TYPES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </Field>

          <Field
            label="Upload proof of residence"
            htmlFor="proofOfResidenceFile"
            error={proofUploadError || state?.fieldErrors?.proofOfResidenceUrl}
            hint={
              proofUploading
                ? "Uploading document…"
                : proofOfResidenceUrl
                  ? `Uploaded ✓ (${proofFileName || "document ready"})`
                  : proofFileName
                    ? `Selected: ${proofFileName}`
                    : "JPG, PNG, WEBP or PDF (max 10MB)"
            }
            required
          >
            <input
              id="proofOfResidenceFile"
              name={proofOfResidenceUrl ? undefined : "proofOfResidenceFile"}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
              required={!proofOfResidenceUrl}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                setProofUploadError("");
                if (!file) {
                  setProofFileName("");
                  return;
                }
                setProofFileName(file.name);
                setProofUploading(true);
                try {
                  const uploadedUrl = await preUploadFile(file, "kyc");
                  setProofOfResidenceUrl(uploadedUrl);
                } catch (err) {
                  setProofOfResidenceUrl("");
                  setProofUploadError(err instanceof Error ? err.message : "Could not upload document");
                } finally {
                  setProofUploading(false);
                }
              }}
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
              value={cacNumber}
              onChange={(e) => setCacNumber(e.target.value)}
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

      {/* Payout Bank Account */}
      <div className="space-y-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4">
        <div className="flex items-start gap-2.5">
          <Landmark className="mt-0.5 size-5 shrink-0 text-emerald-700" />
          <div>
            <h3 className="text-sm font-semibold text-ink-900">Payout Bank Account (Where You Receive Payments)</h3>
            <p className="text-xs text-ink-600">
              Customers pay securely via Paystack escrow at checkout. Once an order is delivered using the customer’s 6-digit PIN, your earnings unlock into your Available Wallet and are sent to this Nigerian bank account.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nigerian bank" htmlFor="bankName" error={state?.fieldErrors?.bankName} required>
            <input
              id="bankName"
              name="bankName"
              list="nigerian-banks-list"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="input"
              required
              placeholder="Select or type bank (e.g. GTBank, OPay)"
            />
            <datalist id="nigerian-banks-list">
              {NIGERIAN_BANKS.map((bank) => (
                <option key={bank} value={bank} />
              ))}
            </datalist>
          </Field>

          <Field
            label="10-digit account number (NUBAN)"
            htmlFor="accountNumber"
            error={state?.fieldErrors?.accountNumber}
            required
          >
            <input
              id="accountNumber"
              name="accountNumber"
              inputMode="numeric"
              maxLength={10}
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="input font-mono tracking-wider"
              required
              placeholder="0123456789"
            />
          </Field>
        </div>

        <Field
          label="Account holder name"
          htmlFor="accountName"
          error={state?.fieldErrors?.accountName}
          hint="Exact name displayed on your bank account (can be updated later in Wallet & Payouts)"
          required
        >
          <input
            id="accountName"
            name="accountName"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            className="input"
            required
            placeholder="e.g. Mama Put Kitchen Ventures or Grace Etim"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Business logo"
          htmlFor="logoFile"
          hint={logoUploading ? "Uploading logo…" : logoUrl ? "Logo uploaded ✓" : "Square image, optional"}
        >
          <input
            id="logoFile"
            name={logoUrl ? undefined : "logoFile"}
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setLogoUploading(true);
              try {
                setLogoUrl(await preUploadFile(file, "logo"));
              } catch {
                setLogoUrl("");
              } finally {
                setLogoUploading(false);
              }
            }}
            className="input py-1.5 text-xs"
          />
        </Field>
        <Field
          label="Cover banner"
          htmlFor="coverFile"
          hint={coverUploading ? "Uploading cover…" : coverUrl ? "Cover uploaded ✓" : "Wide image, optional"}
        >
          <input
            id="coverFile"
            name={coverUrl ? undefined : "coverFile"}
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setCoverUploading(true);
              try {
                setCoverUrl(await preUploadFile(file, "cover"));
              } catch {
                setCoverUrl("");
              } finally {
                setCoverUploading(false);
              }
            }}
            className="input py-1.5 text-xs"
          />
        </Field>
      </div>

      <label className="flex items-start gap-2 text-sm text-ink-600">
        <input
          type="checkbox"
          name="acceptTerms"
          checked={acceptTerms}
          onChange={(e) => setAcceptTerms(e.target.checked)}
          className="mt-0.5 size-4 rounded border-ink-300 text-brand-700"
          required
        />
        <span>
          I confirm this business operates in <strong>Akwa Ibom State</strong> and agree to the{" "}
          <Link href="/terms" className="font-semibold text-brand-800 underline">terms of service</Link> and{" "}
          <Link href="/privacy" className="font-semibold text-brand-800 underline">privacy policy</Link>.
        </span>
      </label>
      {state?.fieldErrors?.acceptTerms ? <p className="error-text">{state.fieldErrors.acceptTerms}</p> : null}

      {anyUploading ? (
        <button type="button" disabled className="btn-primary w-full opacity-70">
          <Loader2 className="size-4 animate-spin" /> Finishing file upload…
        </button>
      ) : isNameLocked ? (
        <button type="button" disabled className="btn-primary w-full cursor-not-allowed opacity-60">
          <Lock className="size-4" /> Business name locked — choose a unique name
        </button>
      ) : (
        <SubmitButton className="w-full" pendingLabel="Creating your storefront…">
          Create my storefront
        </SubmitButton>
      )}
    </form>
  );
}

export function CustomerRegisterForm({ next }: { next?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(registerCustomerAction as Action, initial);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <Feedback state={state} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="Full name" htmlFor="fullName" error={state?.fieldErrors?.fullName} required>
        <input
          id="fullName"
          name="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="input"
          required
        />
      </Field>
      <Field label="Email address" htmlFor="email" error={state?.fieldErrors?.email} required>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
          required
          autoComplete="email"
        />
      </Field>
      <Field label="Phone number" htmlFor="phone" error={state?.fieldErrors?.phone} required>
        <input
          id="phone"
          name="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="input"
          required
          placeholder="0803 123 4567"
        />
      </Field>
      <Field label="Password" htmlFor="password" error={state?.fieldErrors?.password} hint="Min 8 characters, letters & numbers" required>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input pr-10"
            required
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-400 hover:text-ink-700"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
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
