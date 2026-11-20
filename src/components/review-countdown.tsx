"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Clock } from "lucide-react";

function pad(n: number) {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

export function ReviewCountdown({
  deadlineAt,
  createdAt,
  compact = false,
}: {
  deadlineAt?: string | null;
  createdAt?: string | null;
  compact?: boolean;
}) {
  const targetMs = deadlineAt
    ? new Date(deadlineAt).getTime()
    : createdAt
      ? new Date(createdAt).getTime() + 48 * 3_600_000
      : Date.now() + 48 * 3_600_000;

  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const diffMs = targetMs - now;
  const overdue = diffMs <= 0;
  const totalSec = Math.max(0, Math.floor(diffMs / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const urgent = !overdue && hours < 12;

  if (compact) {
    return (
      <span
        suppressHydrationWarning
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold ${
          overdue
            ? "bg-red-100 text-red-800"
            : urgent
              ? "bg-amber-100 text-amber-900"
              : "bg-brand-50 text-brand-900"
        }`}
      >
        <Clock className="size-3" />
        {overdue ? "48h SLA overdue" : `${pad(hours)}h : ${pad(minutes)}m : ${pad(seconds)}s`}
      </span>
    );
  }

  return (
    <div
      suppressHydrationWarning
      className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs ${
        overdue
          ? "border-red-300 bg-red-50 text-red-900"
          : urgent
            ? "border-amber-300 bg-amber-50 text-amber-900"
            : "border-brand-200 bg-brand-50/70 text-brand-900"
      }`}
    >
      <div className="flex items-center gap-2">
        {overdue ? (
          <AlertTriangle className="size-4 shrink-0 text-red-700" />
        ) : (
          <Clock className="size-4 shrink-0 text-brand-700" />
        )}
        <span className="font-semibold">
          {overdue
            ? "48-hour review window elapsed — approve or decline immediately"
            : "48-hour decision timer (approve or decline after reviewing documents)"}
        </span>
      </div>
      <span
        suppressHydrationWarning
        className="rounded-lg bg-white px-2.5 py-1 font-mono text-sm font-bold tracking-wider shadow-xs"
      >
        {overdue ? "00h : 00m : 00s (OVERDUE)" : `${pad(hours)}h : ${pad(minutes)}m : ${pad(seconds)}s`}
      </span>
    </div>
  );
}
