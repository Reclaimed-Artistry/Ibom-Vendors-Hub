"use client";

import { useActionState, useState } from "react";
import { Button, Badge, Alert } from "@/components/ui";
import {
  disburseLoanAction,
  markLoanRepaidAction,
} from "@/app/actions/loan-disbursement";

interface DisbursementActionsProps {
  applicationId: string;
  status: string;
  moneySent: boolean;
  loanPaidOff: boolean;
}

export function DisbursementActions({
  applicationId,
  status,
  moneySent,
  loanPaidOff,
}: DisbursementActionsProps) {
  const [disburseState, disburse] = useActionState(
    disburseLoanAction,
    {} as { error?: string; message?: string },
  );
  const [repaidState, repaid] = useActionState(
    markLoanRepaidAction,
    {} as { error?: string; message?: string },
  );
  const [confirming, setConfirming] = useState<"disburse" | "repaid" | null>(
    null,
  );

  const isDisbursed = moneySent;
  const isRepaid = loanPaidOff;

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm space-y-4">
      <h2 className="text-sm font-semibold text-brand-800 uppercase tracking-wider mb-1">
        Disbursement
      </h2>
      <p className="text-xs text-ink-500">
        Current status:{ " " }
        <span className="font-medium text-ink-900">{status.replace(/_/g, " ")}</span>
      </p>

      {disburseState.error ? (
        <Alert tone="danger">{disburseState.error}</Alert>
      ) : null}
      {disburseState.message ? (
        <Alert tone="success">{disburseState.message}</Alert>
      ) : null}
      {repaidState.error ? <Alert tone="danger">{repaidState.error}</Alert> : null}
      {repaidState.message ? (
        <Alert tone="success">{repaidState.message}</Alert>
      ) : null}

      {!isRepaid && (
        <form action={disburse} className="space-y-3">
          <input type="hidden" name="application_id" value={applicationId} />
          {!isDisbursed ? (
            <Button
              variant="primary"
              disabled={confirming === "disburse"}
              onClick={() => setConfirming("disburse")}
            >
              {confirming === "disburse"
                ? "Confirm disbursement"
                : "Mark funds as disbursed"}
            </Button>
          ) : (
            <Button variant="secondary" disabled>
              Funds disbursed
            </Button>
          )}
          {confirming === "disburse" && !isDisbursed && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirming(null)}
              className="ml-2"
            >
              Cancel
            </Button>
          )}
        </form>
      )}

      {isDisbursed && !isRepaid && (
        <form action={repaid} className="space-y-3">
          <input type="hidden" name="application_id" value={applicationId} />
          <Button
            variant="secondary"
            disabled={confirming === "repaid"}
            onClick={() => setConfirming("repaid")}
          >
            {confirming === "repaid"
              ? "Confirm repayment"
              : "Mark loan as repaid"}
          </Button>
          {confirming === "repaid" && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirming(null)}
              className="ml-2"
            >
              Cancel
            </Button>
          )}
        </form>
      )}

      {isRepaid && (
        <div className="flex items-center gap-2">
          <Badge tone="success">Loan repaid</Badge>
        </div>
      )}
    </div>
  );
}
