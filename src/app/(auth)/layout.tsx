import Link from "next/link";
import { Logo } from "@/components/logo";
import { getSettings } from "@/lib/settings";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-ink-900 p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-40 top-1/4 size-[36rem] rounded-full bg-brand-800/40 blur-3xl" aria-hidden />
        <div className="relative">
          <Logo invert height={48} />
        </div>
        <div className="relative max-w-md">
          <h2 className="font-display text-4xl leading-tight text-white">One login. Every part of your business.</h2>
          <p className="mt-4 text-sm leading-7 text-ink-300">
            Manage your catalogue, accept orders, track production, invoice customers and renew your subscription from a
            single dashboard.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-ink-200">
            {["Category-aware dashboards", "Automatic storefront subdomain", "Subscription with live countdown", "Paystack payments & receipts"].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-brand-500/20 text-brand-300">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-ink-500">© {new Date().getFullYear()} {settings.platform_name}</p>
      </div>
      <div className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo height={44} />
          </div>
          {children}
          <p className="mt-8 text-center text-xs text-ink-400">
            <Link href="/" className="hover:text-ink-700">← Back to marketplace</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
