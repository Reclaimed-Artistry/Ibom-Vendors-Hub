import Link from "next/link";

export const metadata = { title: "Access denied" };

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-6xl font-black text-brand-800">403</p>
        <h1 className="mt-3 text-2xl font-bold">You don&apos;t have access to that page</h1>
        <p className="mt-2 text-sm text-ink-500">Your account does not have permission to view this area. If you think this is a mistake, contact support.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/" className="btn-primary">Back to marketplace</Link>
          <Link href="/login" className="btn-secondary">Switch account</Link>
        </div>
      </div>
    </div>
  );
}
