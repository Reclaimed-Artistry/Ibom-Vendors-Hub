import { NextResponse } from "next/server";
import { appUrl } from "@/lib/domains";
import { systemDb } from "@/lib/db";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { completeGoogleSignIn, GoogleAuthError } from "@/lib/google-auth";
import { logActivity } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

type Role = "super_admin" | "admin" | "vendor" | "customer";

function home(role: Role) {
  if (role === "super_admin" || role === "admin") return "/admin";
  if (role === "vendor") return "/vendor";
  return "/account";
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const fail = (code: string) => NextResponse.redirect(`${appUrl()}/login?oauth=${code}`);

  // Google reports user-side failures (consent denied, etc.) before any code.
  const googleError = params.get("error");
  if (googleError) {
    if (googleError === "access_denied") return fail("cancelled");
    if (googleError === "redirect_uri_mismatch") return fail("redirect");
    if (googleError === "invalid_client" || googleError === "unauthorized_client") return fail("client");
    return fail("failed");
  }

  let identity;
  let pendingNext: string | null = null;
  try {
    const result = await completeGoogleSignIn(params.get("code"), params.get("state"));
    identity = result.identity;
    pendingNext = result.next;
  } catch (error) {
    const message = error instanceof GoogleAuthError ? error.message : "Google sign-in failed.";
    console.error("google sign-in failed:", message);
    if (error instanceof GoogleAuthError) {
      return fail(error.reason === "expired" ? "state" : error.reason);
    }
    return fail("failed");
  }

  const existing = await systemDb.maybeOne<{
    id: string;
    email: string;
    full_name: string;
    role: Role;
    status: string;
    avatar_url: string | null;
    owns_store: boolean;
  }>(
    `select u.id, u.email, u.full_name, u.role, u.status, u.avatar_url,
            exists (select 1 from stores s where s.owner_id = u.id) as owns_store
       from users u
      where lower(u.email) = $1`,
    [identity.email],
  );

  let user: {
    id: string;
    email: string;
    full_name: string;
    role: Role;
    status: string;
    avatar_url: string | null;
  } | null = existing;
  let created = false;

  if (existing) {
    if (existing.status !== "active") return fail("suspended");
    const effectiveRole: Role = existing.role === "customer" && existing.owns_store ? "vendor" : existing.role;
    user = { ...existing, role: effectiveRole };
    await systemDb.execute(
      `update users set last_login_at = now(), avatar_url = coalesce(avatar_url, $2), role = $3 where id = $1`,
      [existing.id, identity.picture ?? null, effectiveRole],
    );
    await logActivity({
      actorId: existing.id,
      actorRole: effectiveRole,
      action: "auth.login",
      entityType: "user",
      entityId: existing.id,
      description: "Signed in with Google",
      meta: { provider: "google" },
    });
  } else {
    // Google is an identity provider, not a way to skip email verification.
    if (!identity.emailVerified) return fail("unverified");

    const inserted = await systemDb.maybeOne<{ id: string; email: string; full_name: string; role: Role; status: string; avatar_url: string | null }>(
      `insert into users (email, password_hash, full_name, role, status, email_verified_at, avatar_url, last_login_at)
       values ($1, null, $2, 'customer', 'active', now(), $3, now())
       on conflict (lower(email)) do nothing
       returning id, email, full_name, role, status, avatar_url`,
      [identity.email, identity.name, identity.picture ?? null],
    );
    if (!inserted) return fail("failed");

    await systemDb.execute(`insert into customer_profiles (user_id) values ($1) on conflict do nothing`, [inserted.id]);
    await systemDb.execute(`insert into user_roles (user_id, role) values ($1,'customer') on conflict do nothing`, [inserted.id]);
    await logActivity({
      actorId: inserted.id,
      actorRole: "customer",
      action: "auth.signup",
      entityType: "user",
      entityId: inserted.id,
      description: "Created a customer account with Google",
      meta: { provider: "google" },
    });

    const settings = await getSettings();
    await sendEmail({
      to: identity.email,
      template: "customer_welcome",
      data: { name: identity.name, supportEmail: settings.support_email },
      dedupeKey: `customer-welcome:${inserted.id}`,
    }).catch((error) => console.error("welcome email failed", error));

    user = inserted;
    created = true;
  }

  if (!user) return fail("failed");

  const token = await createSessionToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.full_name,
  });
  await setSessionCookie(token);

  // A brand-new account lands on its profile with a welcome flag so the first
  // screen explains what to complete rather than showing an empty dashboard.
  const destination = pendingNext ?? (created ? "/account?welcome=google" : home(user.role));
  return NextResponse.redirect(`${appUrl()}${destination}`);
}
