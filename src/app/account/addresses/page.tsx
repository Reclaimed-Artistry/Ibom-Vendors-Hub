import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { AddressForm } from "@/components/address-form";
import { deleteAddressAction, setDefaultAddressAction } from "@/app/actions/account";

export const metadata: Metadata = { title: "My addresses · Ibom Vendors Hub" };

export default async function AccountAddressesPage() {
  const user = await requireUser(["customer"]);
  const rows = await systemDb.query<{
    id: string;
    label: string | null;
    recipient: string;
    phone: string;
    address: string;
    city: string | null;
    state: string | null;
    is_default: boolean;
  }>(`select id, label, recipient, phone, address, city, state, is_default from delivery_addresses where user_id = $1 order by is_default desc, created_at desc`, [user.id]);

  return (
    <div className="space-y-4">
      <PageHeader title="Delivery addresses" description="Saved addresses are offered at checkout to speed things up." />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {rows.length === 0 ? (
            <EmptyState icon={<MapPin className="size-5" />} title="No saved addresses" description="Add your first delivery address to check out faster." />
          ) : (
            rows.map((address) => (
              <Card key={address.id} className="card-pad space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-2 font-semibold text-ink-900">
                      {address.label ?? "Address"} {address.is_default ? <Badge tone="success">Default</Badge> : null}
                    </p>
                    <p className="text-sm text-ink-600">{address.recipient} · {address.phone}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!address.is_default ? (
                      <form action={setDefaultAddressAction}>
                        <input type="hidden" name="addressId" value={address.id} />
                        <button type="submit" className="btn btn-ghost btn-sm">Make default</button>
                      </form>
                    ) : null}
                    <form action={deleteAddressAction}>
                      <input type="hidden" name="addressId" value={address.id} />
                      <button type="submit" className="btn btn-ghost btn-sm text-red-600">Remove</button>
                    </form>
                  </div>
                </div>
                <p className="text-sm text-ink-600">{address.address}</p>
                <p className="text-xs text-ink-400">{[address.city, address.state].filter(Boolean).join(", ")}</p>
                <details>
                  <summary className="cursor-pointer text-xs font-semibold text-brand-700">Edit address</summary>
                  <div className="mt-3">
                    <AddressForm
                      compact
                      address={{
                        id: address.id,
                        label: address.label ?? "",
                        recipient: address.recipient,
                        phone: address.phone,
                        address: address.address,
                        city: address.city ?? "",
                        state: address.state ?? "",
                        isDefault: address.is_default,
                      }}
                    />
                  </div>
                </details>
              </Card>
            ))
          )}
        </div>
        <div>
          <Card className="card-pad space-y-3">
            <h2 className="text-base font-semibold text-ink-900">Add an address</h2>
            <AddressForm compact />
          </Card>
        </div>
      </div>
    </div>
  );
}
