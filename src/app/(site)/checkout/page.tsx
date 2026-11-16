import { CheckoutForm } from "@/components/checkout-form";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { googleConfigured } from "@/lib/google-auth";
import { getCurrentUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  const googleReady = await googleConfigured();
  let address: Record<string, string> = {};
  let phone: string | undefined;
  if (user) {
    const row = await systemDb.maybeOne<{ phone: string | null }>(`select phone from users where id = $1`, [user.id]);
    phone = row?.phone ?? undefined;
    const saved = await systemDb.maybeOne<{ address: string; city: string; state: string; recipient: string; phone: string }>(
      `select address, city, state, recipient, phone from delivery_addresses where user_id = $1 order by is_default desc limit 1`,
      [user.id],
    ).catch(() => null);
    if (saved) {
      address = { address: saved.address, city: saved.city, state: saved.state };
      phone = phone || saved.phone;
    }
  }

  return (
    <div className="container-page py-10">
      <h1 className="font-display text-3xl text-ink-900">Checkout</h1>
      <p className="mt-1 text-sm text-ink-500">
        {user ? `Signed in as ${user.email}` : "Checking out as a guest — you can create an account after payment."}
      </p>
      {!user && googleReady ? (
        <div className="mt-5 max-w-md rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-ink-900">Save time — sign in with Google</p>
          <GoogleAuthButton label="Continue with Google" next="/checkout" divider={false} />
          <p className="mt-2 text-xs text-ink-400">
            We&apos;ll fill in your name, email and phone, keep your cart, and attach the order to your account.
          </p>
        </div>
      ) : null}
      <div className="mt-6">
        <CheckoutForm
          defaultName={user?.fullName}
          defaultEmail={user?.email}
          defaultPhone={phone}
          defaultAddress={address.address}
          defaultCity={address.city ?? "Uyo"}
          defaultState={address.state ?? "Akwa Ibom"}
        />
      </div>
    </div>
  );
}
