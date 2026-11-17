import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn, formatMoney, initials } from "@/lib/utils";

export function Button({
  variant = "primary",
  size,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "ghost" | "danger" | "gold"; size?: "sm" }) {
  const variants = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    ghost: "btn-ghost",
    danger: "btn-danger",
    gold: "btn-gold",
  };
  return <button className={cn(variants[variant], size === "sm" && "btn-sm", className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: "primary" | "secondary" | "ghost" | "danger" | "gold"; size?: "sm" }) {
  const variants = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    ghost: "btn-ghost",
    danger: "btn-danger",
    gold: "btn-gold",
  };
  return <Link className={cn(variants[variant], size === "sm" && "btn-sm", className)} {...props} />;
}

export function Card({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("card", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-5 py-4 sm:px-6">
      <div>
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-ink-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

type Tone = "success" | "warning" | "danger" | "info" | "neutral";
const toneClass: Record<Tone, string> = {
  success: "badge-success",
  warning: "badge-warning",
  danger: "badge-danger",
  info: "badge-info",
  neutral: "badge-neutral",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn(toneClass[tone], className)}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: Tone; label: string }> = {
    active: { tone: "success", label: "Active" },
    trialing: { tone: "info", label: "Trial" },
    pending: { tone: "warning", label: "Pending" },
    suspended: { tone: "danger", label: "Suspended" },
    expired: { tone: "danger", label: "Expired" },
    rejected: { tone: "danger", label: "Rejected" },
    paid: { tone: "success", label: "Paid" },
    unpaid: { tone: "warning", label: "Unpaid" },
    failed: { tone: "danger", label: "Failed" },
    refunded: { tone: "info", label: "Refunded" },
    success: { tone: "success", label: "Successful" },
    published: { tone: "success", label: "Published" },
    open: { tone: "warning", label: "Open" },
    resolved: { tone: "success", label: "Resolved" },
    closed: { tone: "neutral", label: "Closed" },
    confirmed: { tone: "success", label: "Confirmed" },
    requested: { tone: "warning", label: "Requested" },
    quoted: { tone: "info", label: "Quoted" },
    accepted: { tone: "success", label: "Accepted" },
    completed: { tone: "success", label: "Completed" },
    cancelled: { tone: "danger", label: "Cancelled" },
    delivered: { tone: "success", label: "Delivered" },
    dispatched: { tone: "info", label: "Dispatched" },
    in_production: { tone: "info", label: "In production" },
    production_completed: { tone: "info", label: "Production completed" },
    preparing: { tone: "info", label: "Preparing" },
    processed: { tone: "success", label: "Processed" },
    dismissed: { tone: "neutral", label: "Dismissed" },
  };
  const entry = map[status] ?? { tone: "neutral" as Tone, label: status.replace(/_/g, " ") };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
  required,
}: {
  label?: ReactNode;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  required?: boolean;
}) {
  return (
    <div className={className}>
      {label ? (
        <label className="label" htmlFor={htmlFor}>
          {label} {required ? <span className="text-red-500">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <p className="error-text">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function Alert({ tone = "info", title, children }: { tone?: "info" | "success" | "warning" | "danger"; title?: string; children?: ReactNode }) {
  const styles = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    success: "border-brand-200 bg-brand-50 text-brand-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-800",
  };
  return (
    <div className={cn("rounded-xl border px-4 py-3 text-sm", styles[tone])} role="status">
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={cn(title && "mt-1", "text-[13px] leading-6")}>{children}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-white px-6 py-14 text-center">
      {icon ? <div className="mb-3 text-ink-300">{icon}</div> : null}
      <h3 className="text-base font-semibold text-ink-900">{title}</h3>
      {description ? <p className="mt-1 max-w-md text-sm text-ink-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  href?: string;
}) {
  const inner = (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value mt-1.5">{value}</p>
        {hint ? <p className="mt-1 text-xs text-ink-400">{hint}</p> : null}
      </div>
      {icon ? (
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            tone === "success" && "bg-brand-50 text-brand-700",
            tone === "warning" && "bg-amber-50 text-amber-700",
            tone === "danger" && "bg-red-50 text-red-600",
            tone === "info" && "bg-sky-50 text-sky-700",
            tone === "neutral" && "bg-ink-100 text-ink-500",
          )}
        >
          {icon}
        </span>
      ) : null}
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="card card-pad block transition hover:border-brand-300 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-brand-500" aria-label={`${label} — view list`}>
        {inner}
      </Link>
    );
  }
  return <div className="card card-pad">{inner}</div>;
}

export function Avatar({ name, src, size = 40 }: { name: string; src?: string | null; size?: number }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className="shrink-0 rounded-full border border-ink-100 object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-brand-800 text-xs font-bold text-white"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function Money({ amount, currency = "NGN", symbol = "₦" }: { amount: number | string | null; currency?: string; symbol?: string }) {
  return <span className="tabular-nums">{formatMoney(amount, currency, symbol)}</span>;
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {breadcrumb ? <div className="mb-1.5 text-xs text-ink-400">{breadcrumb}</div> : null}
        <h1 className="text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-ink-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Tabs({ links }: { links: Array<{ href: string; label: string; active?: boolean; badge?: ReactNode }> }) {
  return (
    <div className="mb-5 flex flex-wrap gap-1.5 rounded-xl border border-ink-100 bg-white p-1.5">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            link.active ? "bg-brand-800 text-white" : "text-ink-600 hover:bg-ink-100",
          )}
        >
          {link.label}
          {link.badge ? <span className="ml-1.5 text-xs opacity-80">{link.badge}</span> : null}
        </Link>
      ))}
    </div>
  );
}

export function Pagination({ page, totalPages, buildHref }: { page: number; totalPages: number; buildHref: (page: number) => string }) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (candidate) => candidate === 1 || candidate === totalPages || Math.abs(candidate - page) <= 1,
  );
  return (
    <nav className="mt-6 flex items-center justify-center gap-1" aria-label="Pagination">
      {page > 1 ? (
        <Link href={buildHref(page - 1)} className="btn-secondary btn-sm">
          Previous
        </Link>
      ) : null}
      {pages.map((candidate, index) => (
        <span key={candidate} className="flex items-center gap-1">
          {index > 0 && candidate - pages[index - 1] > 1 ? <span className="px-1 text-ink-400">…</span> : null}
          <Link
            href={buildHref(candidate)}
            className={cn(
              "flex size-8 items-center justify-center rounded-lg text-sm font-medium",
              candidate === page ? "bg-brand-800 text-white" : "text-ink-600 hover:bg-ink-100",
            )}
          >
            {candidate}
          </Link>
        </span>
      ))}
      {page < totalPages ? (
        <Link href={buildHref(page + 1)} className="btn-secondary btn-sm">
          Next
        </Link>
      ) : null}
    </nav>
  );
}
