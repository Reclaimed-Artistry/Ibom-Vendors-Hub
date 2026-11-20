"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateOrderTimingAction, type TimingState } from "@/app/actions/order-timing";
import { Alert, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function OrderTimingForm({ orderId, pickup, expectedAt, note }: { orderId: string; pickup: boolean; expectedAt: string | null; note: string | null }) {
  const [state, action] = useActionState<TimingState, FormData>(updateOrderTimingAction, {});
  const localTime = expectedAt ? new Date(new Date(expectedAt).getTime() + 3600000).toISOString().slice(0, 16) : "";
  return <form action={action} className="space-y-3">
    <input type="hidden" name="orderId" value={orderId} />
    {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
    {state.message ? <Alert tone="success">{state.message}</Alert> : null}
    <Field label={pickup ? "When should the customer come for pickup?" : "When will the order arrive at the customer’s location?"} htmlFor="expectedAt" required hint="All times are Nigeria time (WAT, UTC+1). You can update this estimate if plans change.">
      <input id="expectedAt" name="expectedAt" type="datetime-local" className="input" defaultValue={localTime} required />
    </Field>
    <Field label="Message to the customer (optional)" htmlFor="timingNote" hint={pickup ? "For example: Please come to our shop from this time and call when you arrive." : "For example: Our rider will call when approaching your address."}>
      <textarea id="timingNote" name="timingNote" className="textarea" maxLength={500} rows={3} defaultValue={note ?? ""} />
    </Field>
    <SubmitButton pendingLabel="Notifying customer…">{pickup ? "Send pickup time" : "Send arrival time"}</SubmitButton>
  </form>;
}

export function OrderTimingRefresh() {
  const router = useRouter();
  useEffect(() => { const timer = setInterval(() => { if (!document.hidden) router.refresh(); }, 10000); return () => clearInterval(timer); }, [router]);
  return null;
}
