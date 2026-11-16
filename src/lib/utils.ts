import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatMoney(amount: number | string | null | undefined, currency = "NGN", symbol = "₦") {
  const value = Number(amount ?? 0);
  if (Number.isNaN(value)) return `${symbol}0`;
  const formatted = value.toLocaleString("en-NG", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}

export function formatNumber(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString("en-NG");
}

export function formatDate(
  value: string | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", opts);
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}, ${date.toLocaleTimeString(
    "en-GB",
    { hour: "2-digit", minute: "2-digit" },
  )}`;
}

export function timeAgo(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  const diff = Date.now() - date.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}

export function daysBetween(from: Date | string, to: Date | string) {
  const a = typeof from === "string" ? new Date(from) : from;
  const b = typeof to === "string" ? new Date(to) : to;
  return Math.ceil((b.getTime() - a.getTime()) / 86_400_000);
}

/** Human countdown used by the subscription card. */
export function countdownLabel(expiresAt: string | Date | null | undefined) {
  if (!expiresAt) return { label: "No active subscription", tone: "muted" as const, days: 0 };
  const expires = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  const ms = expires.getTime() - Date.now();
  if (ms <= 0) return { label: "Expired", tone: "danger" as const, days: 0 };
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days >= 1) {
    return {
      label: `${days} day${days === 1 ? "" : "s"} remaining`,
      tone: days <= 3 ? ("warning" as const) : ("success" as const),
      days,
    };
  }
  return {
    label: `${hours} hour${hours === 1 ? "" : "s"} remaining`,
    tone: "warning" as const,
    days: 0,
  };
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function truncate(value: string | null | undefined, length = 120) {
  if (!value) return "";
  return value.length > length ? `${value.slice(0, length).trimEnd()}…` : value;
}

/** Parse a JSON-ish input safely. */
export function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "object") return value as T;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function normalisePhone(phone: string | null | undefined) {
  return (phone ?? "").replace(/[^\d+]/g, "");
}

export function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(date: Date | string, days: number) {
  const base = typeof date === "string" ? new Date(date) : new Date(date.getTime());
  base.setDate(base.getDate() + days);
  return base;
}
