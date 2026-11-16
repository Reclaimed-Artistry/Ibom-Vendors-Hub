"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Clock, ShieldAlert } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface CountdownParts {
  expired: boolean;
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function computeCountdown(expiresAt: string | null | undefined, nowMs: number): CountdownParts {
  if (!expiresAt) {
    return { expired: true, totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  const target = new Date(expiresAt).getTime();
  if (Number.isNaN(target) || target <= nowMs) {
    return { expired: true, totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  const diff = target - nowMs;
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1_000);
  return { expired: false, totalMs: diff, days, hours, minutes, seconds };
}

function pad2(value: number) {
  return String(Math.max(0, value)).padStart(2, "0");
}

export interface SubscriptionCountdownProps {
  expiresAt: string | null;
  startedAt?: string | null;
  planName?: string | null;
  status?: string | null;
  isSuspendedForExpiry?: boolean;
  variant?: "hero" | "sidebar" | "header";
  autoRefreshOnExpire?: boolean;
}

export function SubscriptionCountdown({
  expiresAt,
  startedAt,
  planName,
  status,
  isSuspendedForExpiry = false,
  variant = "hero",
  autoRefreshOnExpire = true,
}: SubscriptionCountdownProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const refreshedOnZero = useRef(false);
  const startedUnexpired = useRef(Boolean(expiresAt && new Date(expiresAt).getTime() > Date.now()));

  useEffect(() => {
    setMounted(true);
    setNowMs(Date.now());
    if (!expiresAt) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNowMs(current);
      if (
        autoRefreshOnExpire &&
        startedUnexpired.current &&
        !refreshedOnZero.current &&
        new Date(expiresAt).getTime() <= current
      ) {
        refreshedOnZero.current = true;
        router.refresh();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, autoRefreshOnExpire, router]);

  const parts = computeCountdown(expiresAt, nowMs);
  const isExpired = isSuspendedForExpiry || parts.expired;
  const isCritical = !isExpired && parts.totalMs <= 86_400_000;
  const isWarning = !isExpired && !isCritical && parts.days <= 5;

  if (variant === "header") {
    if (isExpired) {
      return (
        <Link
          href="/vendor/subscription"
          className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
        >
          <ShieldAlert className="size-3.5 shrink-0" />
          <span>Expired · Suspended</span>
        </Link>
      );
    }

    const pillTone = isCritical
      ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
      : isWarning
        ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
        : "border-ink-200 bg-ink-50 text-ink-700 hover:bg-ink-100";

    return (
      <Link
        href="/vendor/subscription"
        title={expiresAt ? `Subscription expires ${formatDateTime(expiresAt)}` : undefined}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tabular-nums transition ${pillTone}`}
      >
        <Clock className="size-3.5 shrink-0" />
        {mounted ? (
          <span>
            {parts.days}d {pad2(parts.hours)}h {pad2(parts.minutes)}m {pad2(parts.seconds)}s
          </span>
        ) : (
          <span>{parts.days}d remaining</span>
        )}
      </Link>
    );
  }

  if (variant === "sidebar") {
    const units = [
      { label: "Days", value: mounted ? String(parts.days) : isExpired ? "0" : String(parts.days) },
      { label: "Hrs", value: mounted ? pad2(parts.hours) : "00" },
      { label: "Min", value: mounted ? pad2(parts.minutes) : "00" },
      { label: "Sec", value: mounted ? pad2(parts.seconds) : "00" },
    ];

    const tileTone = isExpired
      ? "border-red-200 bg-red-50/80 text-red-800"
      : isCritical
        ? "border-red-200 bg-red-50/70 text-red-800"
        : isWarning
          ? "border-amber-200 bg-amber-50/80 text-amber-900"
          : "border-ink-100 bg-ink-50 text-ink-900";

    return (
      <div className="mt-2 space-y-2">
        <div className="grid grid-cols-4 gap-1.5 text-center tabular-nums" aria-live="off">
          {units.map((unit) => (
            <div key={unit.label} className={`rounded-xl border px-1 py-1.5 ${tileTone}`}>
              <p className="text-sm font-bold leading-none">{unit.value}</p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide opacity-70">{unit.label}</p>
            </div>
          ))}
        </div>
        {isExpired ? (
          <p className="flex items-center gap-1 text-xs font-semibold text-red-700">
            <ShieldAlert className="size-3.5 shrink-0" /> Account suspended — renew plan
          </p>
        ) : (
          <p className={`text-xs ${isCritical ? "font-semibold text-red-700" : isWarning ? "font-semibold text-amber-700" : "text-ink-500"}`}>
            {expiresAt ? `Expires ${formatDateTime(expiresAt)}` : "Active"}
          </p>
        )}
      </div>
    );
  }

  // Hero variant (Subscription page & Vendor Overview card)
  let progressPercent = 0;
  if (!isExpired && expiresAt) {
    const endMs = new Date(expiresAt).getTime();
    const startMs = startedAt ? new Date(startedAt).getTime() : endMs - 30 * 86_400_000;
    const span = Math.max(endMs - startMs, 86_400_000);
    progressPercent = Math.min(100, Math.max(2, ((endMs - nowMs) / span) * 100));
  }

  const wrapperTone = isExpired
    ? "border-red-200 bg-gradient-to-br from-red-50 via-white to-red-50/50"
    : isCritical
      ? "border-red-200 bg-gradient-to-br from-red-50/70 via-white to-amber-50/40"
      : isWarning
        ? "border-amber-200 bg-gradient-to-br from-amber-50/80 via-white to-amber-50/30"
        : "border-brand-200 bg-gradient-to-br from-brand-50/60 via-white to-white";

  const tileTone = isExpired
    ? "border-red-200 bg-white text-red-700"
    : isCritical
      ? "border-red-200 bg-white text-red-700"
      : isWarning
        ? "border-amber-200 bg-white text-amber-900"
        : "border-ink-100 bg-white text-ink-900";

  const barTone = isExpired || isCritical ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-brand-600";

  const heroUnits = [
    { label: "Days", value: mounted ? pad2(parts.days) : isExpired ? "00" : pad2(parts.days) },
    { label: "Hours", value: mounted ? pad2(parts.hours) : "00" },
    { label: "Minutes", value: mounted ? pad2(parts.minutes) : "00" },
    { label: "Seconds", value: mounted ? pad2(parts.seconds) : "00" },
  ];

  return (
    <div className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${wrapperTone}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-500">
            {isExpired ? <ShieldAlert className="size-3.5 text-red-600" /> : isWarning || isCritical ? <AlertTriangle className="size-3.5 text-amber-600" /> : <Clock className="size-3.5 text-brand-600" />}
            {isExpired ? "Subscription expired" : status === "trialing" ? "Free trial countdown" : "Subscription expiry countdown"}
          </p>
          <p className="mt-1 text-lg font-bold text-ink-900">
            {planName ?? (isExpired ? "No active subscription" : "Active plan")}
          </p>
          <p className="mt-0.5 text-xs text-ink-500">
            {expiresAt
              ? isExpired
                ? `Expired on ${formatDateTime(expiresAt)} — account suspended until renewal`
                : `Renews / expires ${formatDateTime(expiresAt)}`
              : "Choose a plan below to activate your vendor account and storefront"}
          </p>
        </div>

        <span
          className={`badge ${
            isExpired
              ? "badge-danger"
              : isCritical
                ? "badge-danger"
                : isWarning
                  ? "badge-warning"
                  : "badge-success"
          }`}
        >
          {isExpired
            ? "Account suspended"
            : isCritical
              ? "Expiring < 24h"
              : isWarning
                ? "Expiring soon"
                : status === "trialing"
                  ? "Trial active"
                  : "Active"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 sm:gap-3 tabular-nums" aria-label="Time until subscription expiry">
        {heroUnits.map((unit) => (
          <div key={unit.label} className={`rounded-xl border px-2 py-2.5 text-center shadow-xs sm:py-3 ${tileTone}`}>
            <p className="text-xl font-extrabold tracking-tight sm:text-2xl">{unit.value}</p>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{unit.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-1.5">
        <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
          <div className={`h-full rounded-full transition-all duration-500 ${barTone}`} style={{ width: `${isExpired ? 100 : progressPercent}%` }} />
        </div>
        <p className="text-[11px] text-ink-500">
          {isExpired
            ? "Dashboard tools and public storefront access are suspended until you renew a plan. None of your data has been deleted."
            : "When this countdown reaches 00:00:00:00, your vendor account and storefront are automatically suspended until you renew."}
        </p>
      </div>
    </div>
  );
}
