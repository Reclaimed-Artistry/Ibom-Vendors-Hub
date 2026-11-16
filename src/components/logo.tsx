import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/", invert = false }: { className?: string; href?: string; invert?: boolean }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)} aria-label="Ibom Vendors Hub home">
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-xl text-sm font-black tracking-tight",
          invert ? "bg-white text-brand-900" : "bg-brand-900 text-white",
        )}
      >
        IV
      </span>
      <span className="leading-none">
        <span className={cn("block font-display text-[17px] font-bold tracking-tight", invert ? "text-white" : "text-ink-900")}>
          Ibom Vendors Hub
        </span>
        <span className={cn("mt-1 block text-[10px] font-semibold uppercase tracking-[0.18em]", invert ? "text-brand-200" : "text-ink-400")}>
          Akwa Ibom marketplace
        </span>
      </span>
    </Link>
  );
}
