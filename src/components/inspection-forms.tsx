"use client";

import { useActionState } from "react";
import { bookInspectionAction, saveInspectionSlotAction, withdrawInspectionSlotAction, type InspectionState } from "@/app/actions/inspections";
import { Alert, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import type { InspectionSlot } from "@/lib/property-inspections";

function time(value: string) { return new Intl.DateTimeFormat("en-NG",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Lagos"}).format(new Date(value))+" WAT"; }
function Note({state}:{state:InspectionState}) { return state.error ? <Alert tone="danger">{state.error}</Alert> : state.message ? <Alert tone="success">{state.message}</Alert> : null; }
function Withdraw({id}:{id:string}) {
  const [state, action] = useActionState(withdrawInspectionSlotAction,{});
  return <form action={action}><input type="hidden" name="slotId" value={id}/><Note state={state}/><SubmitButton className="btn-secondary mt-2" pendingLabel="Withdrawing…">Withdraw slot</SubmitButton></form>;
}
export function InspectionSlotManager({productId,slots,office}:{productId:string;slots:InspectionSlot[];office:string}) {
  const [state,action] = useActionState(saveInspectionSlotAction,{});
  return <section className="card card-pad mt-6 space-y-4">
    <div><h2 className="text-lg font-bold">Inspection availability</h2><p className="text-sm text-ink-500">Publish a separate slot for each visit. Slots cannot overlap across your properties. All times are Nigeria time (WAT, UTC+1). To change a booked visit, contact the customer, cancel it in Bookings, and agree on a new slot.</p></div>
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="productId" value={productId}/><div className="sm:col-span-2"><Note state={state}/></div>
      <Field label="Available date and time (WAT)" required><input className="input" type="datetime-local" name="startsAt" required/></Field>
      <Field label="Inspection duration (minutes)" required><input className="input" type="number" name="duration" min="15" max="240" defaultValue="60" required/></Field>
      <Field label="Meet at" required><select name="meetingType" className="select"><option value="office">My office</option><option value="agreed_location">Another specified meeting location</option></select></Field>
      <Field label="Exact meeting address and landmark" required hint="Customers see this before booking. For another location, enter a specific place both parties can identify; do not leave it as ‘to be agreed’."><textarea className="textarea" name="meetingPoint" minLength={5} maxLength={500} defaultValue={office} required/></Field>
      <SubmitButton className="btn-primary" pendingLabel="Publishing…">Publish inspection slot</SubmitButton>
    </form>
    <div className="grid gap-3 sm:grid-cols-2">{slots.map(slot=><div className="rounded-xl border p-3 text-sm" key={slot.id}><p className="font-semibold">{time(slot.starts_at)}</p><p>{slot.meeting_type === "office" ? "Office" : "Meeting location"}: {slot.meeting_point}</p><p className="mt-1 text-xs">{slot.booked ? "Booked — manage in Bookings" : slot.is_active ? "Available" : "Withdrawn"}</p>{slot.is_active && !slot.booked ? <Withdraw id={slot.id}/> : null}</div>)}</div>
    {!slots.length ? <p className="text-sm text-ink-500">No upcoming inspection slots. Publish one to let customers book.</p> : null}
  </section>;
}
export function InspectionBookingForm({slots,fee}:{slots:InspectionSlot[];fee:number}) {
  const [state,action] = useActionState(bookInspectionAction,{});
  if (state.message) return <Note state={state}/>;
  if (!slots.length) return <Alert tone="info">No inspection times are available. Contact the agent and check back when they publish new slots.</Alert>;
  return <form action={action} className="space-y-4">
    <Note state={state}/><p className="rounded-xl bg-brand-50 p-3 text-sm">Inspection fee: <strong>{fee === 0 ? "Free" : `₦${fee.toLocaleString()}`}</strong>. This is separate from the property price. Pay directly to the agent by arrangement; nothing is collected online. Agree on fee and cancellation terms before paying.</p>
    <fieldset className="space-y-3"><legend className="mb-2 font-semibold">Choose the agent’s available time and meeting point</legend>{slots.map(slot=><label key={slot.id} className="flex cursor-pointer gap-3 rounded-xl border p-4"><input type="radio" name="slotId" value={slot.id} required className="mt-1"/><span><strong className="block text-sm">{time(slot.starts_at)} – {new Intl.DateTimeFormat("en-NG",{hour:"2-digit",minute:"2-digit",timeZone:"Africa/Lagos"}).format(new Date(slot.ends_at))}</strong><span className="block text-sm text-ink-600">{slot.meeting_type === "office" ? "Agent’s office" : "Meeting location"}: {slot.meeting_point}</span></span></label>)}</fieldset>
    <Field label="Your phone number" required><input name="phone" type="tel" className="input" required minLength={7} maxLength={25}/></Field>
    <Field label="Message / access needs (optional)"><textarea name="notes" className="textarea" maxLength={1000}/></Field>
    <label className="flex gap-2 text-sm"><input type="checkbox" required/>I have reviewed the inspection fee, meeting point and time. I understand this is a request awaiting the agent’s confirmation.</label>
    <SubmitButton className="btn-primary w-full" pendingLabel="Booking…">Book inspection</SubmitButton>
  </form>;
}
