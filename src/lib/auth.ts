import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { systemDb, withSystem, type Actor } from "@/lib/db";
import type { SessionUser, Store } from "@/lib/types";

const COOKIE = "ivh_session";
const SESSION_DAYS = 30;

async function isHttpsRequest(): Promise<boolean> {
  try {
    const h = await headers();
    const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
    if (proto === "https") return true;
    if (proto === "http") return false;
    const origin = h.get("origin") ?? h.get("referer") ?? "";
    if (origin.startsWith("https://")) return true;
    if (origin.startsWith("http://")) return false;
  } catch {
    // Called outside request context
  }
  return Boolean(process.env.VERCEL);
}

function secretKey() {
  const secret =
    process.env.AUTH_SECRET ??
    (process.env.NODE_ENV === "production"
      ? ""
      : "development-only-insecure-secret-please-change-me-32chars");
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET must be set to a strong random value");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 11);
}

export async function verifyPassword(password: string, hash: string | null) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

interface SessionPayload {
  sub: string;
  email: string;
  role: string;
  name: string;
}

export async function createSessionToken(user: SessionPayload) {
  return new SignJWT({ email: user.email, role: user.role, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  const secure = await isHttpsRequest();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  const secure = await isHttpsRequest();
  store.set(COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  });
}

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: SessionUser["role"];
  status: SessionUser["status"];
  avatar_url: string | null;
  email_verified_at: string | null;
  owns_store: boolean;
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const id = payload.sub;
    if (!id) return null;
    const row = await systemDb.maybeOne<UserRow>(
      `select u.id, u.email, u.full_name, u.role, u.status, u.avatar_url, u.email_verified_at,
              exists (select 1 from stores s where s.owner_id = u.id) as owns_store
         from users u where u.id = $1`,
      [id],
    );
    if (!row || row.status !== "active") return null;
    const effectiveRole: SessionUser["role"] =
      row.role === "customer" && row.owns_store ? "vendor" : row.role;
    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role: effectiveRole,
      avatarUrl: row.avatar_url,
      emailVerified: Boolean(row.email_verified_at),
      status: row.status,
    };
  } catch {
    return null;
  }
});

export function actorFor(user: SessionUser | null): Actor {
  if (!user) return { id: null, role: "anon", email: null };
  return { id: user.id, role: user.role, email: user.email };
}

export async function requireUser(roles?: SessionUser["role"][], next?: string) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  }
  if (roles && !roles.includes(user.role)) {
    redirect("/forbidden");
  }
  return user;
}

export async function requireAdmin() {
  return requireUser(["admin", "super_admin"]);
}

export async function requireVendor() {
  return requireUser(["vendor"]);
}

export async function requireCustomer() {
  return requireUser(["customer"]);
}

export interface VendorSubscription {
  id: string;
  status: "trialing" | "active" | "expired" | "cancelled" | "pending";
  started_at: string;
  expires_at: string;
  plan_id: string;
  plan_name: string | null;
  plan_price: number | null;
  plan_features: string[] | null;
}

export interface VendorContext {
  user: SessionUser;
  store: Store;
  subscription: VendorSubscription | null;
  lastSubscription: VendorSubscription | null;
  effectiveExpiresAt: string | null;
  effectiveStartedAt: string | null;
  isSubscriptionExpired: boolean;
  isManuallySuspended: boolean;
  isAccountSuspended: boolean;
  category: import("@/lib/types").StoreCategory | null;
}

/** Vendor dashboard context: guarantees the user owns a store and immediately enforces overdue subscription expiry. */
export const getVendorContext = cache(async (): Promise<VendorContext> => {
  const user = await requireUser(["vendor"]);
  let store = await systemDb.maybeOne<Store>(
    `select * from stores where owner_id = $1 order by created_at limit 1`,
    [user.id],
  );
  if (!store) redirect("/vendor/onboarding");

  const overdueSub = await systemDb.maybeOne<{ id: string }>(
    `select id from subscriptions
      where store_id = $1 and status in ('trialing','active') and expires_at <= now()
      limit 1`,
    [store.id],
  );
  const overdueGrant =
    !store.manual_suspension &&
    (store.status === "active" || store.status === "pending") &&
    Boolean(store.access_until && new Date(store.access_until).getTime() <= Date.now());

  if (overdueSub || overdueGrant) {
    await withSystem((db) => db.query(`select * from process_subscription_expiry()`));
    const refreshed = await systemDb.maybeOne<Store>(`select * from stores where id = $1`, [store.id]);
    if (refreshed) store = refreshed;
  }

  const [subscription, lastSubscription] = await Promise.all([
    systemDb.maybeOne<VendorSubscription>(
      `select s.id, s.status, s.started_at, s.expires_at, s.plan_id, p.name as plan_name, p.price as plan_price,
              p.features as plan_features
         from subscriptions s
         join subscription_plans p on p.id = s.plan_id
        where s.store_id = $1 and s.status in ('trialing','active') and s.expires_at > now()
        order by s.expires_at desc limit 1`,
      [store.id],
    ),
    systemDb.maybeOne<VendorSubscription>(
      `select s.id, s.status, s.started_at, s.expires_at, s.plan_id, p.name as plan_name, p.price as plan_price,
              p.features as plan_features
         from subscriptions s
         join subscription_plans p on p.id = s.plan_id
        where s.store_id = $1
        order by s.expires_at desc limit 1`,
      [store.id],
    ),
  ]);

  const hasUnexpiredAccessGrant = Boolean(
    store.access_until && new Date(store.access_until).getTime() > Date.now(),
  );
  const effectiveExpiresAt = subscription?.expires_at ?? (hasUnexpiredAccessGrant ? store.access_until : null);
  const effectiveStartedAt = subscription?.started_at ?? null;
  const isManuallySuspended = Boolean(store.manual_suspension || store.status === "suspended");
  const isSubscriptionExpired =
    !isManuallySuspended &&
    store.status !== "rejected" &&
    (store.status === "expired" || (!subscription && !hasUnexpiredAccessGrant));
  const isAccountSuspended = isSubscriptionExpired || isManuallySuspended || store.status === "rejected";

  const category = store.category_id
    ? await systemDb.maybeOne<import("@/lib/types").StoreCategory>(
        `select * from store_categories where id = $1`,
        [store.category_id],
      )
    : null;

  return {
    user,
    store,
    subscription,
    lastSubscription,
    effectiveExpiresAt,
    effectiveStartedAt,
    isSubscriptionExpired,
    isManuallySuspended,
    isAccountSuspended,
    category,
  };
});

/**
 * Operational vendor page guard: suspends dashboard navigation on subscription
 * expiry and redirects the vendor directly to the subscription renewal screen.
 */
export async function requireActiveVendorContext(): Promise<VendorContext> {
  const ctx = await getVendorContext();
  if (ctx.isSubscriptionExpired) {
    redirect("/vendor/subscription?suspended=1");
  }
  return ctx;
}

/** Returns a human-readable lock message when a vendor account is suspended, or null when operational. */
export function vendorSuspensionMessage(ctx: VendorContext): string | null {
  if (ctx.isSubscriptionExpired) {
    return "Your vendor account is suspended because your subscription has expired. Renew your subscription to restore access.";
  }
  if (ctx.isManuallySuspended) {
    return `Your store is suspended${ctx.store.suspension_reason ? `: ${ctx.store.suspension_reason}` : "."}`;
  }
  if (ctx.store.status === "rejected") {
    return "Your store application was not approved.";
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* One-time tokens (email verification, password reset)                       */
/* -------------------------------------------------------------------------- */

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createAuthToken(
  userId: string,
  type: "verify_email" | "reset_password" | "email_change",
  ttlMinutes = 60,
  payload: Record<string, unknown> = {},
) {
  const token = crypto.randomBytes(32).toString("hex");
  await systemDb.execute(
    `insert into auth_tokens (user_id, type, token_hash, payload, expires_at)
     values ($1, $2, $3, $4::jsonb, now() + make_interval(mins => $5))`,
    [userId, type, hashToken(token), JSON.stringify(payload), ttlMinutes],
  );
  return token;
}

export async function consumeAuthToken(
  token: string,
  type: "verify_email" | "reset_password" | "email_change",
) {
  const row = await systemDb.maybeOne<{ id: string; user_id: string; payload: Record<string, unknown> }>(
    `select id, user_id, payload from auth_tokens
      where token_hash = $1 and type = $2 and used_at is null and expires_at > now()
      limit 1`,
    [hashToken(token), type],
  );
  if (!row) return null;
  await systemDb.execute(`update auth_tokens set used_at = now() where id = $1`, [row.id]);
  return row;
}

/* -------------------------------------------------------------------------- */
/* Simple in-memory throttle (per server instance)                            */
/* -------------------------------------------------------------------------- */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, max = 8, windowMs = 60_000) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1 };
  }
  bucket.count += 1;
  if (bucket.count > max) return { allowed: false, remaining: 0 };
  return { allowed: true, remaining: max - bucket.count };
}
