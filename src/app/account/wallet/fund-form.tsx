"use client";

import { useActionState, useEffect, useState } from "react";
import { Banknote } from "lucide-react";
import { fundWalletAction, type WalletState } from "@/app/actions/wallet";
import { Alert, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function WalletFundForm() {
  const [state, fundAction] = useActionState<WalletState, FormData>(fundWalletAction, {});
  const [fundingAmount, setFundingAmount] = useState("");

  // Redirect to PayStack (or sandbox) once the top-up transaction is created.
  useEffect(() => {
    if (state?.redirectUrl) {
      window.location.href = state.redirectUrl;
    }
  }, [state?.redirectUrl]);

  if (state?.error) {
    return <Alert tone="danger">{state.error}</Alert>;
  }
  if (state?.message) {
    return <Alert tone="success">{state.message}</Alert>;
  }

  return (
    <form action={fundAction} className="space-y-3" id="fund-wallet-form">
      <Field label="Amount to add (₦)" htmlFor="wallet-amount" required>
        <input
          id="wallet-amount"
          name="amount"
          type="number"
          min="100"
          step="100"
          defaultValue={fundingAmount}
          onChange={(e) => setFundingAmount(e.target.value)}
          className="input"
          required
          placeholder="e.g. 5000"
        />
      </Field>
      <p className="text-xs text-ink-500">
        Minimum top-up is ₦100. You will be redirected to PayStack to complete the payment.
      </p>
      <SubmitButton className="btn-primary w-full" pendingLabel="Starting top-up…">
        <Banknote className="mr-2 size-4" /> Fund wallet
      </SubmitButton>
    </form>
  );
}
