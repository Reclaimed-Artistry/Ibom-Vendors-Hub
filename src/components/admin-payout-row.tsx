"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { reviewRefundAction, settleVendorPayoutAction, type AdminState } from "@/app/actions/admin";
import { SubmitButton } from "@/components/submit-button";

const initial: AdminState = {};

export function AdminPayoutSettlementControls({ payoutId }: { payoutId: string }) {
  const [state, action] = useActionState(settleVendorPayoutAction, initial);
  const [reference, setReference] = useState("");

  return (
    <div className="space-y-1.5">
      {state.error ? <p className="text-xs font-medium text-red-600">{state.error}</p> : null}
      {state.message ? <p className="text-xs font-medium text-emerald-700">{state.message}</p> : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <form action={action} className="flex flex-wrap items-center gap-1.5">
          <input type="hidden" name="payoutId" value={payoutId} />
          <input type="hidden" name="decision" value="paid" />
          <input
            name="reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Bank / Paystack ref"
            className="input h-8 w-36 py-1 text-xs font-mono"
          />
          <SubmitButton className="btn-primary btn-sm" pendingLabel="Marking…">
            <CheckCircle2 className="size-3.5" /> Mark paid
          </SubmitButton>
        </form>
        <form action={action}>
          <input type="hidden" name="payoutId" value={payoutId} />
          <input type="hidden" name="decision" value="failed" />
          <SubmitButton className="btn-secondary btn-sm" pendingLabel="Returning…">
            <RotateCcw className="size-3.5" /> Return to wallet
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}

export function AdminRefundDecisionControls({ refundId }: { refundId: string }) {
  const [state, action] = useActionState(reviewRefundAction, initial);

  return (
    <div className="space-y-1">
      {state.error ? <p className="text-xs font-medium text-red-600">{state.error}</p> : null}
      {state.message ? <p className="text-xs font-medium text-emerald-700">{state.message}</p> : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <form action={action}>
          <input type="hidden" name="refundId" value={refundId} />
          <input type="hidden" name="decision" value="approve" />
          <SubmitButton className="btn-primary btn-sm" pendingLabel="Processing…">
            <CheckCircle2 className="size-3.5" /> Approve refund
          </SubmitButton>
        </form>
        <form action={action}>
          <input type="hidden" name="refundId" value={refundId} />
          <input type="hidden" name="decision" value="reject" />
          <SubmitButton className="btn-secondary btn-sm" pendingLabel="Rejecting…">
            <XCircle className="size-3.5" /> Reject
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
