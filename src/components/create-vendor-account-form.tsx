"use client";

import { useActionState, useState } from "react";
import { UserPlus } from "lucide-react";
import { createVendorAccountForAdminAction } from "@/app/actions/admin";
import { Alert, Button, Card, CardHeader, Field } from "@/components/ui";

type FormState = {
  error?: string;
  message?: string;
  vendorUserId?: string;
  storeId?: string;
};

export function CreateVendorAccountForm({
  categories,
}: {
  categories: Array<{ id: string; name: string }>;
}) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    createVendorAccountForAdminAction,
    { error: undefined, message: undefined },
  );
  const [created, setCreated] = useState(false);

  if (state?.message && !state.error) {
    setCreated(true);
  }

  if (created) {
    return (
      <Card className="card-pad border-brand-200 bg-brand-50">
        <CardHeader title="Vendor account created" />
        <p className="text-sm text-brand-900">
          The vendor account has been created successfully. You can now click{" "}
          <span className="font-semibold">Vendor&apos;s view</span> on any vendor in the
          admin panel to see exactly what that vendor sees in their dashboard.
        </p>
      </Card>
    );
  }

  return (
    <Card className="card-pad">
      <CardHeader
        title="Create vendor account (admin only)"
        description="Provision a vendor user account and linked store so you can log in as that vendor and see exactly what vendors see."
      />
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <form action={formAction} className="space-y-3">
        <Field label="Store name" htmlFor="storeName" required>
          <input
            id="storeName"
            name="storeName"
            className="input"
            placeholder="e.g. Test Vendor Store"
            required
          />
        </Field>
        <Field label="Store slug" htmlFor="storeSlug" hint="URL-friendly address, e.g. test-vendor">
          <input
            id="storeSlug"
            name="storeSlug"
            className="input"
            placeholder="test-vendor"
            required
          />
        </Field>
        <Field label="Vendor email" htmlFor="email" hint="The email the vendor will log in with">
          <input
            id="email"
            name="email"
            type="email"
            className="input"
            placeholder="vendor@example.com"
            required
          />
        </Field>
        <Field label="Password" htmlFor="password" hint="Minimum 8 characters">
          <input
            id="password"
            name="password"
            type="password"
            className="input"
            required
          />
        </Field>
        <Field label="Category" htmlFor="categoryId" hint="Optional business category">
          <select id="categoryId" name="categoryId" className="select">
            <option value="">None</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </Field>
        <Button type="submit" disabled={isPending} className="btn-primary w-auto">
          {isPending ? "Creating…" : <><UserPlus className="mr-2 size-4" /> Create vendor account</>}
        </Button>
      </form>
    </Card>
  );
}
