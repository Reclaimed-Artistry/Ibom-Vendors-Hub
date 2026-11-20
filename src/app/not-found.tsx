import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-6xl font-black text-brand-800">404</p>
        <h1 className="mt-3 text-2xl font-bold">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-sm text-ink-500">The storefront or page you are looking for may have moved or is no longer online.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/" className="btn-primary">Marketplace home</Link>
          <Link href="/stores" className="btn-secondary">Browse vendors</Link>
        </div>
      </div>
    </div>
  );
}
