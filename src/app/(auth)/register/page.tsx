import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock, LogIn, ShieldCheck, Store, UserPlus } from "lucide-react";
import { VendorRegisterForm } from "@/components/auth-forms";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { getCurrentUser } from "@/lib/auth";
import { getCategoriesWithCounts } from "@/lib/storefront";
import { getSettings } from "@/lib/settings";
import { systemDb } from "@/lib/db";

export const metadata = { title: "Create a Storefront" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; next?: string }>;
}) {
  const params = await searchParams;

  // Backward compatibility for `/register?role=customer`
  if (params.role === "customer") {
    const query = params.next ? `?next=${encodeURIComponent(params.next)}` : "";
    redirect(`/register/customer${query}`);
  }

  const currentUser = await getCurrentUser();

  // Gate: Users can ONLY view or submit the storefront creation form AFTER signing in with Google or creating an account first.
  if (!currentUser) {
    return (
      <div className="space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800">
          <Lock className="size-3.5" /> Account required first
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">
            Sign in or create an account first
          </h1>
          <p className="mt-2 text-sm leading-6 text-ink-600">
            To open a storefront on Ibom Vendors Hub, first sign in with your Google account or create your account.
            Once you are signed in, you&apos;ll immediately get the option to create your verified Akwa Ibom storefront.
          </p>
        </div>

        <div className="space-y-3 rounded-2xl border border-ink-200 bg-white p-5 shadow-soft">
          <GoogleAuthButton label="Sign in with Google to continue" next="/register" divider={false} />

          <Link
            href="/register/customer?next=%2Fregister"
            className="btn-primary flex w-full items-center justify-center gap-2"
          >
            <UserPlus className="size-4" /> Create an account first
          </Link>

          <Link
            href="/login?next=%2Fregister"
            className="btn-secondary flex w-full items-center justify-center gap-2"
          >
            <LogIn className="size-4" /> Sign in to existing account
          </Link>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl border border-ink-100 bg-ink-50/70 p-3.5 text-xs text-ink-600">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-700" />
          <p>
            Every vendor storefront is tied to a verified account owner, has a globally unique locked business name,
            and accepts customer bank transfers directly into your Nigerian bank account.
          </p>
        </div>
      </div>
    );
  }

  if (currentUser.role === "admin" || currentUser.role === "super_admin") {
    redirect("/admin");
  }

  const existingStore = await systemDb.maybeOne<{ id: string }>(
    `select id from stores where owner_id = $1 limit 1`,
    [currentUser.id],
  );
  if (existingStore) redirect("/vendor");

  const [categories, settings, userRecord] = await Promise.all([
    getCategoriesWithCounts(),
    getSettings(),
    systemDb.maybeOne<{ phone: string | null }>(`select phone from users where id = $1`, [currentUser.id]),
  ]);
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? settings.main_domain ?? "ibomvendorshub.com";

  return (
    <div>
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
        <Store className="size-3.5" /> Account verified · Storefront setup unlocked
      </div>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">Create your Akwa Ibom storefront</h1>
      <p className="mt-1.5 text-sm text-ink-500">
        Choose your unique business name, verify your Akwa Ibom address, and add the Nigerian bank account where you receive customer payouts. Includes a {settings.default_trial_days}-day free trial.
      </p>

      <div className="mt-6">
        <VendorRegisterForm
          categories={categories}
          rootDomain={rootDomain}
          initialUser={{
            fullName: currentUser.fullName,
            email: currentUser.email,
            phone: userRecord?.phone,
          }}
        />
      </div>

      <p className="mt-6 text-sm text-ink-500">
        Not ready right now?{" "}
        <Link href="/account" className="font-semibold text-brand-800 hover:text-brand-900">
          Return to My Account
        </Link>
      </p>
    </div>
  );
}
