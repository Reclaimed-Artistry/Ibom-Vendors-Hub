import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The official Ibom Vendors Hub lockup.
 *
 * The artwork (shopping bag + Akwa Ibom mark, swoosh, wordmark and the
 * "One Hub. Every business. Endless opportunities." tagline) is used whole and
 * never cropped: the files in /public/brand only had fully transparent padding
 * removed. Sizing is height-driven with `w-auto` + `object-contain`, so the
 * aspect ratio is preserved at every breakpoint.
 *
 * `invert` places the lockup on a white chip for dark surfaces, because the
 * wordmark is dark green and would otherwise lose contrast.
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
      className={cn("group inline-flex shrink-0 items-center", className)}
      aria-label="Ibom Vendors Hub — home"
    >
      <span className={cn("inline-flex items-center", invert && "rounded-xl bg-white px-3 py-2 shadow-sm")}>
        <picture>
          <source srcSet="/brand/ibom-vendors-hub-logo.webp" type="image/webp" />
          <img
            src="/brand/ibom-vendors-hub-logo.png"
            alt="Ibom Vendors Hub — One Hub. Every Business. Endless Opportunities."
            width={1200}
            height={416}
            style={{ height, width: "auto" }}
            className="block object-contain"
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
    <picture className={className}>
      <source srcSet="/brand/ibom-vendors-hub-logo.webp" type="image/webp" />
      <img
        src="/brand/ibom-vendors-hub-logo.png"
        alt="Ibom Vendors Hub"
        width={1200}
        height={416}
        style={{ height, width: "auto" }}
        className="block object-contain"
      />
    </picture>
  );
}
