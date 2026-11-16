import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/checkout-form";
import { getCurrentUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";

export const metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=%2Fcheckout");
  }

  const [userRow, savedAddress, customerProfile] = await Promise.all([
    systemDb.maybeOne<{ phone: string | null }>(
      `select phone from users where id = $1`,
      [user.id],
    ),
    systemDb.maybeOne<{
      recipient: string;
      phone: string;
      address: string;
      city: string | null;
      state: string | null;
    }>(
      `select recipient, phone, address, city, state from delivery_addresses
        where user_id = $1 order by is_default desc, created_at desc limit 1`,
      [user.id],
    ),
    systemDb.maybeOne<{
      default_address: Record<string, string>;
      city: string | null;
      state: string | null;
    }>(
      `select default_address, city, state from customer_profiles where user_id = $1`,
      [user.id],
    ),
  ]);

  const profileAddr = customerProfile?.default_address ?? {};

  return (
    <div className="container-page py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Checkout</h1>
        <p className="mt-1 text-sm text-ink-500">
          Signed in as <span className="font-semibold text-ink-800">{user.email}</span>. Confirm your bio details and choose dispatch delivery or pickup at the vendor&apos;s Akwa Ibom location.
        </p>
      </div>
      <CheckoutForm
        defaults={{
          name: savedAddress?.recipient ?? user.fullName,
          email: user.email,
          phone: savedAddress?.phone ?? profileAddr.phone ?? userRow?.phone ?? "",
          bioAddress: profileAddr.bio_address ?? savedAddress?.address ?? profileAddr.address ?? "",
          address: savedAddress?.address ?? profileAddr.address ?? "",
          city: savedAddress?.city ?? customerProfile?.city ?? profileAddr.city ?? "Uyo",
          state: savedAddress?.state ?? customerProfile?.state ?? profileAddr.state ?? "Akwa Ibom",
        }}
      />
    </div>
  );
}
