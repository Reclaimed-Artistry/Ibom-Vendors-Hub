import Link from "next/link";
import { CustomerRegisterForm } from "@/components/auth-forms";
import { GoogleAuthButton } from "@/components/google-auth-button";

export const metadata = { title: "Create a customer account" };

export default function RegisterCustomerPage() {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Customer account</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Create your account</h1>
      <p className="mt-1.5 text-sm text-ink-500">Track orders, save delivery addresses and review your purchases.</p>
      <div className="mt-6 space-y-5">
        <GoogleAuthButton label="Sign up with Google" />
        <CustomerRegisterForm />
      </div>
      <p className="mt-6 text-sm text-ink-500">
        Own a business? <Link href="/register" className="font-semibold text-brand-800 hover:text-brand-900">Open a storefront</Link>
      </p>
    </div>
  );
}
