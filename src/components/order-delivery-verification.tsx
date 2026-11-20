"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, KeyRound, ShieldCheck } from "lucide-react";
import {
  confirmOrderDeliveryAction,
  reportOrderDeliveryIssueAction,
  type PublicState,
} from "@/app/actions/public";
import { Alert, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

type Action = (prev: PublicState, formData: FormData) => Promise<PublicState>;

export function OrderDeliveryVerification({
  orderId,
  status,
  paymentStatus,
  fulfilmentType,
  deliveryPin,
  deliveryConfirmedAt,
  deliveryConfirmedBy,
  disputeStatus,
  disputeReason,
  dispatchRiderName,
  dispatchRiderPhone,
  pickupLocation,
}: {
  orderId: string;
  status: string;
  paymentStatus: string;
  fulfilmentType: string;
  deliveryPin?: string;
  deliveryConfirmedAt: string | null;
  deliveryConfirmedBy: string | null;
  disputeStatus: string;
  disputeReason: string | null;
  dispatchRiderName: string | null;
  dispatchRiderPhone: string | null;
  pickupLocation: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [confirmState, confirmAction] = useActionState<PublicState, FormData>(
    confirmOrderDeliveryAction as Action,
    {},
  );
  const [disputeState, disputeAction] = useActionState<PublicState, FormData>(
    reportOrderDeliveryIssueAction as Action,
    {},
  );

  const isCancelled = ["cancelled", "rejected", "refunded", "expired"].includes(status);
  if (isCancelled || paymentStatus !== "paid") return null;

  const isConfirmed = Boolean(deliveryConfirmedAt) || ["delivered", "completed"].includes(status);

  const copyPin = async () => {
    if (!deliveryPin) return;
    try {
      await navigator.clipboard.writeText(deliveryPin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-brand-200 bg-brand-50/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-700" />
          <div>
            <h2 className="text-base font-semibold text-ink-900">
              {isConfirmed ? "Delivery verified & completed" : "Delivery & pickup verification"}
            </h2>
            <p className="text-xs text-ink-600">
              {isConfirmed
                ? `Handover verified (${deliveryConfirmedBy === "pin" ? "via your 6-digit Delivery PIN" : "confirmed by you"}). Vendor payout has been released.`
                : "Your payment is held safely until handover is verified with your 6-digit PIN or you confirm receipt below."}
            </p>
          </div>
        </div>
        {isConfirmed ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="size-3.5" /> Verified receipt
          </span>
        ) : null}
      </div>

      {pickupLocation && fulfilmentType === "pickup" ? (
        <div className="rounded-xl border border-ink-200 bg-white p-3 text-xs text-ink-700">
          <p className="font-semibold text-ink-900">Vendor pickup location</p>
          <p className="mt-0.5">{pickupLocation}</p>
        </div>
      ) : null}

      {dispatchRiderName || dispatchRiderPhone ? (
        <div className="rounded-xl border border-ink-200 bg-white p-3 text-xs text-ink-700">
          <p className="font-semibold text-ink-900">Assigned dispatch rider</p>
          <p className="mt-0.5">
            {dispatchRiderName ?? "Dispatch rider"}
            {dispatchRiderPhone ? ` · ${dispatchRiderPhone}` : ""}
          </p>
        </div>
      ) : null}

      {!isConfirmed && deliveryPin ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-300 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand-100 text-brand-800">
              <KeyRound className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                Your 6-digit {fulfilmentType === "pickup" ? "Pickup" : "Delivery"} PIN
              </p>
              <p className="font-mono text-2xl font-bold tracking-[0.28em] text-ink-900">
                {deliveryPin}
              </p>
            </div>
          </div>
          <button type="button" onClick={copyPin} className="btn-secondary btn-sm">
            <Copy className="size-3.5" /> {copied ? "Copied!" : "Copy PIN"}
          </button>
          <p className="w-full text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
            <strong>Important:</strong> Only give this PIN to the vendor or dispatch rider{" "}
            <strong>after</strong> inspecting and receiving your item.
          </p>
        </div>
      ) : null}

      {disputeStatus === "open" ? (
        <Alert tone="warning" title="Delivery dispute open — vendor payout on hold">
          {disputeReason ?? "Our support team and the vendor have been notified."}
        </Alert>
      ) : null}

      {confirmState?.error ? <Alert tone="danger">{confirmState.error}</Alert> : null}
      {confirmState?.message ? <Alert tone="success">{confirmState.message}</Alert> : null}
      {disputeState?.error ? <Alert tone="danger">{disputeState.error}</Alert> : null}
      {disputeState?.message ? <Alert tone="success">{disputeState.message}</Alert> : null}

      {!isConfirmed ? (
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <form action={confirmAction}>
            <input type="hidden" name="orderId" value={orderId} />
            <SubmitButton className="btn-primary btn-sm" pendingLabel="Confirming receipt…">
              <CheckCircle2 className="size-4" /> Confirm I received this order
            </SubmitButton>
          </form>

          {disputeStatus !== "open" ? (
            <button
              type="button"
              onClick={() => setShowDisputeForm((v) => !v)}
              className="btn-secondary btn-sm text-red-700"
            >
              <AlertTriangle className="size-3.5" /> Report non-delivery / issue
            </button>
          ) : null}
        </div>
      ) : null}

      {showDisputeForm && disputeStatus !== "open" ? (
        <form action={disputeAction} className="space-y-3 rounded-xl border border-red-200 bg-white p-4">
          <input type="hidden" name="orderId" value={orderId} />
          <Field label="What went wrong?" htmlFor={`dispute-reason-${orderId}`} required>
            <input
              id={`dispute-reason-${orderId}`}
              name="reason"
              className="input"
              required
              minLength={5}
              placeholder="e.g. Marked dispatched over 24h ago and rider hasn't arrived / wrong item delivered"
            />
          </Field>
          <Field label="Additional details (optional)" htmlFor={`dispute-details-${orderId}`}>
            <textarea
              id={`dispute-details-${orderId}`}
              name="details"
              rows={2}
              className="textarea"
              placeholder="Any phone call details or photos/notes to help our team resolve this fast"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowDisputeForm(false)} className="btn-ghost btn-sm">
              Cancel
            </button>
            <SubmitButton className="btn-primary btn-sm bg-red-600 hover:bg-red-700" pendingLabel="Submitting…">
              Hold payout &amp; submit dispute
            </SubmitButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}
