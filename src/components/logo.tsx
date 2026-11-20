import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The official Ibom Vendors Hub lockup.
 * Preserves aspect ratio at every breakpoint while shrinking gracefully on
 * narrow mobile screens so headers never overflow horizontally.
 */
export function Logo({
  className,
  href = "/",
  invert = false,
  height = 40,
}: {
  className?: string;
  href?: string;
  invert?: boolean;
  height?: number;
}) {
  return (
    <Link
      href={href}
      className={cn("group inline-flex min-w-0 max-w-[42vw] shrink items-center sm:max-w-none sm:shrink-0", className)}
      aria-label="Ibom Vendors Hub — home"
    >
      <span className={cn("inline-flex max-w-full items-center", invert && "rounded-xl bg-white px-3 py-2 shadow-sm")}>
        <picture className="block max-w-full">
          <source srcSet="/brand/ibom-vendors-hub-logo.webp" type="image/webp" />
          <img
            src="/brand/ibom-vendors-hub-logo.png"
            alt="Ibom Vendors Hub — One Hub. Every Business. Endless Opportunities."
            width={1200}
            height={416}
            style={{ maxHeight: height, width: "auto" }}
            className="block h-auto max-w-full object-contain"
            decoding="async"
          />
        </picture>
      </span>
    </Link>
  );
}

/** Bare lockup (no link) for footers of emails, receipts and print views. */
export function LogoMark({ height = 32, className }: { height?: number; className?: string }) {
  return (
    <picture className={cn("block max-w-full", className)}>
      <source srcSet="/brand/ibom-vendors-hub-logo.webp" type="image/webp" />
      <img
        src="/brand/ibom-vendors-hub-logo.png"
        alt="Ibom Vendors Hub"
        width={1200}
        height={416}
        style={{ maxHeight: height, width: "auto" }}
        className="block h-auto max-w-full object-contain"
      />
    </picture>
  );
}
