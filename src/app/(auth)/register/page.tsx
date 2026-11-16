import Link from "next/link";
import { redirect } from "next/navigation";
import { CustomerRegisterForm, VendorRegisterForm } from "@/components/auth-forms";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { getCurrentUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { getStoreCategories } from "@/lib/storefront";
import { rootDomain } from "@/lib/domains";

export const metadata = { title: "Create an account" };
export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; next?: string }>;
}) {
  const params = await searchParams;
  const isCustomer = params.role === "customer";
  const nextQuery = params.next ? `&next=${encodeURIComponent(params.next)}` : "";

  const currentUser = await getCurrentUser();
  let initialUser: { fullName?: string; email?: string; phone?: string | null } | undefined;

  if (currentUser) {
    if (isCustomer) {
      if (params.next && params.next.startsWith("/")) redirect(params.next);
      redirect(currentUser.role === "vendor" ? "/vendor" : currentUser.role === "customer" ? "/account" : "/admin");
    } else {
      const existingStore = await systemDb.maybeOne<{ id: string }>(
        `select id from stores where owner_id = $1 limit 1`,
        [currentUser.id],
      );
      if (existingStore) {
        redirect("/vendor");
      }
      if (currentUser.role === "customer" || currentUser.role === "vendor") {
        const profileRow = await systemDb.maybeOne<{ phone: string | null }>(
          `select phone from users where id = $1`,
          [currentUser.id],
        );
        initialUser = {
          fullName: currentUser.fullName,
          email: currentUser.email,
          phone: profileRow?.phone ?? "",
        };
      }
    }
  }

  const categories = isCustomer ? [] : await getStoreCategories();

  return (
    <div>
      <div className="mb-6 inline-flex rounded-xl bg-ink-100 p-1 text-xs font-semibold">
        <Link
          href="/register"
          className={`rounded-lg px-3.5 py-1.5 transition ${!isCustomer ? "bg-white text-ink-900 shadow-soft" : "text-ink-500"}`}
        >
          Akwa Ibom business
        </Link>
        <Link
          href={`/register?role=customer${nextQuery}`}
          className={`rounded-lg px-3.5 py-1.5 transition ${isCustomer ? "bg-white text-ink-900 shadow-soft" : "text-ink-500"}`}
        >
          Customer account
        </Link>
      </div>

      {isCustomer ? (
        <>
          <h1 className="text-2xl font-bold tracking-tight">Create a customer account</h1>
          <p className="mt-1.5 text-sm text-ink-500">
            Required to check out, receive your delivery verification PIN, and review verified purchases.
          </p>
          <div className="mt-6 space-y-5">
            <GoogleAuthButton label="Sign up with Google" next={params.next ?? "/account"} />
            <CustomerRegisterForm next={params.next} />
          </div>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold tracking-tight">Open your Akwa Ibom storefront</h1>
          <p className="mt-1.5 text-sm text-ink-500">
            Get your own business address on Ibom Vendors Hub with a free 14-day trial. Exclusively for Akwa Ibom State merchants.
          </p>
          <div className="mt-6">
            <VendorRegisterForm categories={categories} rootDomain={rootDomain()} initialUser={initialUser} />
          </div>
        </>
      )}

      <p className="mt-6 text-sm text-ink-500">
        Already have an account?{" "}
        <Link
          href={params.next ? `/login?next=${encodeURIComponent(params.next)}` : "/login"}
          className="font-semibold text-brand-800 hover:text-brand-900"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
