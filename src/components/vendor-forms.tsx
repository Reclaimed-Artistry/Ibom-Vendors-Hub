"use client";

import { useActionState, useEffect } from "react";
import type { ReactNode } from "react";
import { Send } from "lucide-react";
import {
  bookingAction,
  createProductCategoryAction,
  purchaseSubscriptionAction,
  replyMessageAction,
  respondQuotationAction,
  respondReviewAction,
  vendorOrderAction,
  type VendorState,
} from "@/app/actions/vendor";
import { Alert, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function CategoryForm() {
  const [state, formAction] = useActionState<VendorState, FormData>(createProductCategoryAction, {});
  return (
    <form action={formAction} className="card-pad space-y-3">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}
      <Field label="Name" htmlFor="category-name" required>
        <input id="category-name" name="name" className="input" placeholder="e.g. Small chops" required maxLength={60} />
      </Field>
      <SubmitButton className="btn-primary w-full" pendingLabel="Adding…">Add category</SubmitButton>
    </form>
  );
}

export function OrderUpdateForm({
  orderId,
  actions,
  children,
}: {
  orderId: string;
  actions: Array<{ key: string; label: string }>;
  children?: ReactNode;
}) {
  const [state, formAction] = useActionState<VendorState, FormData>(vendorOrderAction, {});
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}
      <Field label="Next step" htmlFor={`action-${orderId}`} required>
        <select id={`action-${orderId}`} name="action" className="select" required defaultValue={actions[0]?.key ?? ""}>
          {actions.map((action) => (
            <option key={action.key} value={action.key}>{action.label}</option>
          ))}
        </select>
      </Field>
      {children}
      <Field label="Note to customer (optional)" htmlFor={`note-${orderId}`}>
        <textarea id={`note-${orderId}`} name="note" className="textarea" placeholder="Included in the customer's order timeline." />
      </Field>
      <SubmitButton className="btn-primary w-full" pendingLabel="Updating…">Update order</SubmitButton>
    </form>
  );
}

export function QuotationResponseForm({
  quotationId,
  suggestedAmount,
}: {
  quotationId: string;
  suggestedAmount: string;
}) {
  const [state, formAction] = useActionState<VendorState, FormData>(respondQuotationAction, {});
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="quotationId" value={quotationId} />
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Quoted amount (₦)" htmlFor={`amount-${quotationId}`} required>
          <input id={`amount-${quotationId}`} name="amount" type="number" min="0" step="0.01" className="input" defaultValue={suggestedAmount} required />
        </Field>
        <Field label="Valid for (days)" htmlFor={`valid-${quotationId}`}>
          <input id={`valid-${quotationId}`} name="validDays" type="number" min="1" max="90" className="input" defaultValue="7" />
        </Field>
      </div>
      <Field label="Message to customer" htmlFor={`qnote-${quotationId}`}>
        <textarea id={`qnote-${quotationId}`} name="note" className="textarea" placeholder="What the price includes, timelines, assumptions…" />
      </Field>
      <SubmitButton className="btn-primary" pendingLabel="Sending…">Send quotation</SubmitButton>
    </form>
  );
}

export function ReviewResponseForm({ reviewId }: { reviewId: string }) {
  const [state, formAction] = useActionState<VendorState, FormData>(respondReviewAction, {});
  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="reviewId" value={reviewId} />
      {state.error ? <p className="error-text">{state.error}</p> : null}
      {state.message ? <p className="text-xs font-semibold text-brand-700">{state.message}</p> : null}
      <textarea
        name="response"
        className="textarea min-h-20"
        placeholder="Reply publicly to this review…"
        maxLength={1500}
        required
      />
      <SubmitButton className="btn-secondary btn-sm" pendingLabel="Publishing…">Publish reply</SubmitButton>
    </form>
  );
}

export function MessageReplyForm({ messageId }: { messageId: string }) {
  const [state, formAction] = useActionState<VendorState, FormData>(replyMessageAction, {});
  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="messageId" value={messageId} />
      {state.error ? <p className="error-text">{state.error}</p> : null}
      {state.message ? <p className="text-xs font-semibold text-brand-700">{state.message}</p> : null}
      <textarea name="body" className="textarea min-h-24" placeholder="Write your reply…" required />
      <SubmitButton className="btn-secondary btn-sm" pendingLabel="Sending…">Send reply <Send className="size-3.5" /></SubmitButton>
    </form>
  );
}

export function BookingActionForm({ bookingId, status }: { bookingId: string; status: string }) {
  return (
    <form action={bookingAction} className="flex flex-wrap gap-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      {status === "requested" || status === "pending" ? (
        <>
          <button type="submit" name="status" value="confirmed" className="btn btn-primary btn-sm">Confirm</button>
          <button type="submit" name="status" value="cancelled" className="btn btn-ghost btn-sm">Decline</button>
        </>
      ) : null}
      {status === "confirmed" ? (
        <>
          <button type="submit" name="status" value="completed" className="btn btn-secondary btn-sm">Mark completed</button>
          <button type="submit" name="status" value="no_show" className="btn btn-ghost btn-sm">No show</button>
        </>
      ) : null}
    </form>
  );
}

export function SubscriptionPurchaseForm({ planId, label }: { planId: string; label: string }) {
  const [state, formAction] = useActionState<VendorState, FormData>(purchaseSubscriptionAction, {});
  useEffect(() => {
    if (state.redirectUrl) window.location.assign(state.redirectUrl);
  }, [state.redirectUrl]);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="planId" value={planId} />
      {state.error ? <p className="error-text">{state.error}</p> : null}
      {state.message ? <p className="text-sm font-semibold text-brand-700">{state.message}</p> : null}
      <SubmitButton className="btn-primary w-full" pendingLabel="Starting…">{label}</SubmitButton>
    </form>
  );
}
