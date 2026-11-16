"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, ExternalLink, FileCheck2, FileText, Image as ImageIcon, ShieldAlert, XCircle } from "lucide-react";
import { approveStoreDecisionAction, rejectStoreAction, type AdminState } from "@/app/actions/admin";
import { proofOfResidenceLabel } from "@/lib/akwa-ibom";
import { Alert, Badge, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ReviewCountdown } from "@/components/review-countdown";

function isPdfUrl(url: string | null | undefined) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.startsWith("data:application/pdf") || lower.split("?")[0].endsWith(".pdf");
}

export interface StoreReviewSnapshot {
  storeId: string;
  storeName: string;
  storeSlug: string;
  storeStatus: string;
  createdAt: string;
  reviewDeadlineAt?: string | null;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string | null;
  categoryName?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  nin?: string | null;
  proofOfResidenceType?: string | null;
  proofOfResidenceUrl?: string | null;
  cacRegistered?: boolean | null;
  cacNumber?: string | null;
  kycStatus?: string | null;
}

export function KycDocumentReviewPanel({
  snapshot,
  showDecisionActions = true,
}: {
  snapshot: StoreReviewSnapshot;
  showDecisionActions?: boolean;
}) {
  const [approveState, approveAction] = useActionState<AdminState, FormData>(approveStoreDecisionAction, {});
  const [rejectState, rejectAction] = useActionState<AdminState, FormData>(rejectStoreAction, {});
  const [docsChecked, setDocsChecked] = useState(false);

  const hasProof = Boolean(snapshot.proofOfResidenceUrl);
  const isPdf = isPdfUrl(snapshot.proofOfResidenceUrl);

  return (
    <div className="space-y-4">
      {snapshot.storeStatus === "pending" ? (
        <ReviewCountdown deadlineAt={snapshot.reviewDeadlineAt} createdAt={snapshot.createdAt} />
      ) : null}

      <div className="rounded-2xl border border-ink-200 bg-ink-50/40 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-ink-900">Uploaded Registration Documents &amp; Owner Details</p>
            <p className="text-xs text-ink-500">
              Always inspect the uploaded Proof of Residence, NIN, CAC status, and business branding before approving.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={snapshot.nin ? "success" : "danger"}>
              {snapshot.nin ? `NIN: ${snapshot.nin}` : "NIN Missing"}
            </Badge>
            <Badge tone={hasProof ? "success" : "danger"}>
              {hasProof ? "Proof Uploaded" : "No Proof Uploaded"}
            </Badge>
            <Badge tone={snapshot.cacRegistered ? "info" : "neutral"}>
              {snapshot.cacRegistered ? `CAC: ${snapshot.cacNumber || "Provided"}` : "CAC: Unregistered"}
            </Badge>
          </div>
        </div>

        <dl className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-ink-100 bg-white p-3">
            <dt className="font-medium text-ink-500">Storefront Owner</dt>
            <dd className="mt-1 font-semibold text-ink-900">{snapshot.ownerName}</dd>
            <dd className="text-ink-600">{snapshot.ownerEmail}</dd>
            {snapshot.ownerPhone ? <dd className="text-ink-600">{snapshot.ownerPhone}</dd> : null}
          </div>
          <div className="rounded-xl border border-ink-100 bg-white p-3">
            <dt className="font-medium text-ink-500">Akwa Ibom Location &amp; Category</dt>
            <dd className="mt-1 font-semibold text-ink-900">{snapshot.categoryName ?? "General Retail"}</dd>
            <dd className="text-ink-600">
              {[snapshot.address, snapshot.city, snapshot.state ?? "Akwa Ibom"].filter(Boolean).join(", ")}
            </dd>
          </div>
          <div className="rounded-xl border border-ink-100 bg-white p-3">
            <dt className="font-medium text-ink-500">Identity &amp; CAC</dt>
            <dd className="mt-1 font-mono font-semibold text-ink-900">NIN: {snapshot.nin || "Not provided"}</dd>
            <dd className="text-ink-600">
              {snapshot.cacRegistered
                ? `CAC Registered (${snapshot.cacNumber || "—"})`
                : "Operating as unregistered merchant"}
            </dd>
          </div>
        </dl>

        {/* Proof of Residence Inline Viewer */}
        <div className="rounded-xl border border-ink-200 bg-white p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink-900">
              {isPdf ? <FileText className="size-4 text-brand-700" /> : <FileCheck2 className="size-4 text-brand-700" />}
              <span>
                Proof of Residence — {proofOfResidenceLabel(snapshot.proofOfResidenceType)}
              </span>
            </div>
            {snapshot.proofOfResidenceUrl ? (
              <a
                href={snapshot.proofOfResidenceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-100"
              >
                Open full document <ExternalLink className="size-3.5" />
              </a>
            ) : null}
          </div>

          {snapshot.proofOfResidenceUrl ? (
            isPdf ? (
              <iframe
                src={snapshot.proofOfResidenceUrl}
                title="Proof of Residence Document"
                className="h-64 w-full rounded-lg border border-ink-200 bg-ink-50"
              />
            ) : (
              <a href={snapshot.proofOfResidenceUrl} target="_blank" rel="noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={snapshot.proofOfResidenceUrl}
                  alt="Uploaded Proof of Residence"
                  className="max-h-72 w-full rounded-lg border border-ink-200 bg-ink-50 object-contain"
                />
              </a>
            )
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
              <ShieldAlert className="size-4 shrink-0" />
              No Proof of Residence file was uploaded with this registration. Request re-upload or decline.
            </div>
          )}
        </div>

        {/* Uploaded Storefront Logo & Cover Images */}
        {snapshot.logoUrl || snapshot.coverUrl ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {snapshot.logoUrl ? (
              <div className="rounded-xl border border-ink-200 bg-white p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-ink-800">
                    <ImageIcon className="size-3.5 text-brand-700" /> Uploaded Store Logo
                  </span>
                  <a href={snapshot.logoUrl} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">
                    Full size ↗
                  </a>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={snapshot.logoUrl} alt="Store logo" className="h-20 w-20 rounded-xl border border-ink-100 object-cover" />
              </div>
            ) : null}
            {snapshot.coverUrl ? (
              <div className="rounded-xl border border-ink-200 bg-white p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-ink-800">
                    <ImageIcon className="size-3.5 text-brand-700" /> Uploaded Cover Banner
                  </span>
                  <a href={snapshot.coverUrl} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">
                    Full size ↗
                  </a>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={snapshot.coverUrl} alt="Store cover" className="h-20 w-full rounded-xl border border-ink-100 object-cover" />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {showDecisionActions && snapshot.storeStatus === "pending" ? (
        <div className="grid gap-4 rounded-2xl border border-ink-200 bg-white p-4 lg:grid-cols-2">
          <form action={approveAction} className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5">
            <input type="hidden" name="storeId" value={snapshot.storeId} />
            <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-950">
              <CheckCircle2 className="size-4 text-emerald-700" /> Approve &amp; Open Storefront
            </p>
            <p className="text-xs text-emerald-900/80">
              Approving verifies the merchant&apos;s documents, opens{" "}
              <span className="font-semibold">{snapshot.storeName}</span> publicly, and notifies the store owner immediately.
            </p>
            {approveState.error ? <Alert tone="danger">{approveState.error}</Alert> : null}
            {approveState.message ? <Alert tone="success">{approveState.message}</Alert> : null}
            <label className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-white p-2.5 text-xs text-ink-800 cursor-pointer">
              <input
                type="checkbox"
                name="documentsReviewed"
                checked={docsChecked}
                onChange={(e) => setDocsChecked(e.target.checked)}
                required
                className="mt-0.5 size-4 rounded border-ink-300 text-brand-700"
              />
              <span>
                I have reviewed the uploaded Proof of Residence document, NIN, CAC status, and owner details for{" "}
                <strong>{snapshot.storeName}</strong>.
              </span>
            </label>
            <SubmitButton
              className={`btn-primary w-full ${!docsChecked ? "opacity-60" : ""}`}
              pendingLabel="Approving & notifying owner…"
            >
              Approve Store &amp; Notify Owner
            </SubmitButton>
          </form>

          <form action={rejectAction} className="space-y-3 rounded-xl border border-red-200 bg-red-50/30 p-3.5">
            <input type="hidden" name="storeId" value={snapshot.storeId} />
            <p className="flex items-center gap-1.5 text-sm font-bold text-red-950">
              <XCircle className="size-4 text-red-700" /> Decline Storefront Application
            </p>
            <p className="text-xs text-red-900/80">
              Declining keeps the storefront closed and sends your feedback directly to the store owner via email and dashboard notification.
            </p>
            {rejectState.error ? <Alert tone="danger">{rejectState.error}</Alert> : null}
            {rejectState.message ? <Alert tone="success">{rejectState.message}</Alert> : null}
            <Field label="Reason for declining (sent to store owner)" htmlFor={`decline-${snapshot.storeId}`} required>
              <textarea
                id={`decline-${snapshot.storeId}`}
                name="reason"
                rows={2}
                required
                minLength={5}
                className="textarea bg-white text-xs"
                placeholder="e.g. Uploaded Proof of Residence image is unreadable — please upload a clear utility bill or tenancy page."
              />
            </Field>
            <SubmitButton className="btn-danger w-full" pendingLabel="Declining & notifying owner…">
              Decline Store &amp; Notify Owner
            </SubmitButton>
          </form>
        </div>
      ) : null}
    </div>
  );
}
