"use client";

import { useActionState, useState, useEffect, useRef } from "react";
import { Alert, Button } from "@/components/ui";
import { initiateLoanRepaymentAction } from "@/app/actions/loan-repayment";

interface RepayLoanFormProps {
  loan: {
    id: string;
    loan_amount_figures: number;
    total_repayable: number;
    amount_paid: number;
    monthly_repayment_amount: number | null;
    next_payment_due: string | null;
    repayment_frequency: string;
    duration_months: number;
    payment_count: number;
  };
}

/** Format a number with comma thousands separators (e.g. 500000 -> "500,000"). */
function formatWithCommas(value: number): string {
  return new Intl.NumberFormat("en-NG").format(value);
}

/** Strip everything except digits from a typed string. */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function RepayLoanForm({ loan }: RepayLoanFormProps) {
  const [state, formAction] = useActionState(initiateLoanRepaymentAction, {});
  const [amountToPay, setAmountToPay] = useState<string>("");
  const [rawAmount, setRawAmount] = useState<number | null>(null);
  const redirected = useRef(false);

  // Auto-redirect to Monify checkout when URL is available.
  useEffect(() => {
    if (state.checkoutUrl && !redirected.current) {
      redirected.current = true;
      window.location.href = state.checkoutUrl;
    }
  }, [state.checkoutUrl]);

  const remainingBalance = Math.max(
    0,
    loan.total_repayable - loan.amount_paid,
  );
  const defaultAmount = loan.monthly_repayment_amount ?? remainingBalance;

  const formatted = (value: number) =>
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(value);

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = digitsOnly(e.target.value);
    setAmountToPay(raw);
    setRawAmount(raw ? Number(raw) : null);
  }

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-brand-800 uppercase tracking-wider mb-5">
        Make a repayment
      </h3>

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      {state.message && !state.checkoutUrl ? (
        <Alert tone="success">{state.message}</Alert>
      ) : null}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="application_id" value={loan.id} />
        <input
          type="hidden"
          name="amount_to_pay"
          value={rawAmount ?? ""}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-ink-600 mb-1">
              Amount to pay (₦)
            </label>
            <input
              name="amount_display"
              type="text"
              value={rawAmount ? formatWithCommas(rawAmount) : ""}
              onChange={handleAmountChange}
              placeholder={formatWithCommas(defaultAmount)}
              className="input"
              required
            />
            <p className="mt-1 text-xs text-ink-500">
              Remaining balance: {formatted(remainingBalance)}
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-600 mb-1">
              Phone Number
            </label>
            <input
              name="phone_number"
              type="tel"
              className="input"
              required
              placeholder="e.g. 08012345678"
            />
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              className="w-full"
              disabled={!!state.checkoutUrl || !!state.error || !rawAmount}
            >
              {state.checkoutUrl ? "Redirecting to Monify…" : "Pay with Monify"}
            </Button>
          </div>
        </div>

        <p className="text-xs text-ink-500 mt-2">
          You will be redirected to Monify to complete the payment. You can pay by
          card, bank transfer, USSD, or mobile money. A confirmation email will be
          sent once your payment is verified.
        </p>
      </form>
    </div>
  );
}

