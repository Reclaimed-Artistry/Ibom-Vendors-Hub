"use client";

import { useActionState, useState } from "react";
import { ArrowUpRight, Landmark } from "lucide-react";
import {
  requestVendorPayoutAction,
  saveVendorBankAccountAction,
  type VendorState,
} from "@/app/actions/vendor";
import { NIGERIAN_BANKS } from "@/lib/akwa-ibom";
import { Alert, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

const initialState: VendorState = {};

export function VendorBankAccountForm({
  initialBankName,
  initialAccountNumber,
  initialAccountName,
}: {
  initialBankName?: string | null;
  initialAccountNumber?: string | null;
  initialAccountName?: string | null;
}) {
  const [state, action] = useActionState(saveVendorBankAccountAction, initialState);
  const [bankName, setBankName] = useState(initialBankName ?? "");
  const [accountNumber, setAccountNumber] = useState(initialAccountNumber ?? "");
  const [accountName, setAccountName] = useState(initialAccountName ?? "");

  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nigerian bank" htmlFor="bankName" error={state.fieldErrors?.bankName} required>
          <input
            id="bankName"
            name="bankName"
            list="vendor-nigerian-banks"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            className="input"
            required
            placeholder="Select or type bank (e.g. GTBank, OPay)"
          />
          <datalist id="vendor-nigerian-banks">
            {NIGERIAN_BANKS.map((bank) => (
              <option key={bank} value={bank} />
            ))}
          </datalist>
        </Field>

        <Field
          label="10-digit account number (NUBAN)"
          htmlFor="accountNumber"
          error={state.fieldErrors?.accountNumber}
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
        error={state.fieldErrors?.accountName}
        hint="Must match the legal or registered business name on your Nigerian bank account"
        required
      >
        <input
          id="accountName"
          name="accountName"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          className="input"
          required
          placeholder="e.g. Frensic Luxury Apartment Ltd"
        />
      </Field>

      <SubmitButton pendingLabel="Saving bank account…">
        <Landmark className="size-4" /> Save payout bank account
      </SubmitButton>
    </form>
  );
}

export function RequestPayoutForm({
  availableAmount,
  hasBankAccount,
  bankSummary,
}: {
  availableAmount: number;
  hasBankAccount: boolean;
  bankSummary?: string;
}) {
  const [state, action] = useActionState(requestVendorPayoutAction, initialState);
  const [amount, setAmount] = useState(availableAmount >= 500 ? String(Math.floor(availableAmount)) : "");
  const [note, setNote] = useState("");

  if (!hasBankAccount) {
    return (
      <Alert tone="warning">
        Add and save your Nigerian payout bank account first so we know where to transfer your earnings.
      </Alert>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      {bankSummary ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3.5 py-2.5 text-xs text-emerald-950">
          Destination account: <strong>{bankSummary}</strong>
        </div>
      ) : null}

      <Field
        label="Withdrawal amount (₦)"
        htmlFor="payoutAmount"
        hint={`Minimum ₦500 · Available unlocked balance: ₦${availableAmount.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`}
        required
      >
        <input
          id="payoutAmount"
          name="amount"
          type="number"
          min={500}
          max={Math.max(500, availableAmount)}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="input font-semibold"
          required
          disabled={availableAmount < 500}
          placeholder="5000"
        />
      </Field>

      <Field label="Optional note" htmlFor="payoutNote">
        <input
          id="payoutNote"
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="input"
          disabled={availableAmount < 500}
          placeholder="e.g. Weekly settlement"
        />
      </Field>

      {availableAmount < 500 ? (
        <button type="button" disabled className="btn-primary w-full cursor-not-allowed opacity-60">
          Minimum ₦500 unlocked balance required to withdraw
        </button>
      ) : (
        <SubmitButton className="w-full" pendingLabel="Submitting payout request…">
          <ArrowUpRight className="size-4" /> Withdraw to my bank account
        </SubmitButton>
      )}
    </form>
  );
}
