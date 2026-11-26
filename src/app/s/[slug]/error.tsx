"use client";

import Link from "next/link";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function StorefrontError({ error, reset }: ErrorPageProps) {
  console.error("Storefront error boundary:", error);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-6xl font-black text-brand-800">500</p>
        <h1 className="mt-3 text-2xl font-bold">Storefront temporarily unavailable</h1>
        <p className="mt-2 text-sm text-ink-500">
          We encountered an error loading this storefront. Please try again or
          browse other vendors.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row justify-center gap-2">
          <Link href="/" className="btn-primary w-full sm:w-auto">
            Marketplace home
          </Link>
          <button
            onClick={() => reset()}
            className="btn-secondary w-full sm:w-auto"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
