"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { saveAddressAction, type AccountState } from "@/app/actions/account";
import { Alert, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export interface AddressValues {
  id?: string;
  label: string;
  recipient: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  isDefault: boolean;
}

export function AddressForm({ address, compact = false }: { address?: AddressValues; compact?: boolean }) {
  const [state, formAction] = useActionState<AccountState, FormData>(saveAddressAction, {});
  const [open, setOpen] = useState(Boolean(address?.id) || compact);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary btn-sm">
        <Plus className="size-3.5" /> Add address
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      {address?.id ? <input type="hidden" name="addressId" value={address.id} /> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Label" htmlFor={`label-${address?.id ?? "new"}`} hint="Home, Office, Studio…">
          <input id={`label-${address?.id ?? "new"}`} name="label" className="input" defaultValue={address?.label ?? ""} maxLength={40} />
        </Field>
        <Field label="Recipient" htmlFor={`recipient-${address?.id ?? "new"}`} required>
          <input id={`recipient-${address?.id ?? "new"}`} name="recipient" className="input" defaultValue={address?.recipient ?? ""} required />
        </Field>
      </div>
      <Field label="Phone" htmlFor={`phone-${address?.id ?? "new"}`} required>
        <input id={`phone-${address?.id ?? "new"}`} name="phone" className="input" defaultValue={address?.phone ?? ""} required />
      </Field>
      <Field label="Street address" htmlFor={`address-${address?.id ?? "new"}`} required>
        <textarea id={`address-${address?.id ?? "new"}`} name="address" className="textarea" defaultValue={address?.address ?? ""} required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="City" htmlFor={`city-${address?.id ?? "new"}`}>
          <input id={`city-${address?.id ?? "new"}`} name="city" className="input" defaultValue={address?.city ?? ""} />
        </Field>
        <Field label="State" htmlFor={`state-${address?.id ?? "new"}`}>
          <input id={`state-${address?.id ?? "new"}`} name="state" className="input" defaultValue={address?.state ?? ""} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-700">
        <input type="checkbox" name="isDefault" defaultChecked={address?.isDefault ?? false} className="size-4 rounded border-ink-300" /> Set as default address
      </label>
      <div className="flex gap-2">
        <SubmitButton className="btn-primary btn-sm" pendingLabel="Saving…">Save address</SubmitButton>
        {!compact ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
        ) : null}
      </div>
    </form>
  );
}
