"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  clearSessionCookie,
  consumeAuthToken,
  createAuthToken,
  createSessionToken,
  getCurrentUser,
  hashPassword,
  rateLimit,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { systemDb, withSystem } from "@/lib/db";
import { logActivity } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { getSettings, url } from "@/lib/settings";
import { registerCustomer, registerVendor } from "@/lib/stores";
import { uploadImage, uploadVerificationDocument } from "@/lib/storage";
import { AKWA_IBOM_STATE } from "@/lib/akwa-ibom";
import {
  customerRegisterSchema,
  forgotPasswordSchema,
  formatIssues,
  loginSchema,
  resetPasswordSchema,
  vendorRegisterSchema,
} from "@/lib/validation";

export interface ActionState {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  link?: string;
}

const devLinks = () =>
  process.env.NEXT_PUBLIC_DEV_EMAIL_LINKS === "true" && !process.env.RESEND_API_KEY;

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    return { error: "Enter your email and password", fieldErrors: formatIssues(parsed.error) };
  }
  const email = parsed.data.email.trim().toLowerCase();
  const { password, next } = parsed.data;

  const user = await systemDb.maybeOne<{
    id: string;
    email: string;
    password_hash: string | null;
    full_name: string;
    role: "super_admin" | "admin" | "vendor" | "customer";
    status: string;
    owns_store: boolean;
  }>(
    `select u.id, u.email, u.password_hash, u.full_name, u.role, u.status,
            exists (select 1 from stores s where s.owner_id = u.id) as owns_store
       from users u
      where lower(u.email) = $1`,
    [email],
  );

  if (!user) {
    const limit = rateLimit(`login-fail:${email}`, 10, 60_000);
    if (!limit.allowed) return { error: "Too many failed attempts. Please wait a minute and try again." };
    return { error: "No account found with that email address." };
  }
  if (user.status !== "active") {
    return { error: "This account has been suspended. Please contact support." };
  }
  if (!user.password_hash) {
    return {
      error:
        "This account was created with Google sign-in and has no password set yet. Use 'Continue with Google' above, or click 'Forgot password?' to create a password.",
    };
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    const limit = rateLimit(`login-fail:${email}`, 10, 60_000);
    if (!limit.allowed) return { error: "Too many failed attempts. Please wait a minute and try again." };
    return { error: "Incorrect password. Please try again." };
  }

  let effectiveRole = user.role;
  if (user.role === "customer" && user.owns_store) {
    effectiveRole = "vendor";
    await withSystem((db) =>
      db.execute(`update users set role = 'vendor', updated_at = now() where id = $1`, [user.id]),
    );
  }

  const token = await createSessionToken({
    sub: user.id,
    email: user.email,
    role: effectiveRole,
    name: user.full_name,
  });
  await setSessionCookie(token);
  await systemDb.execute(`update users set last_login_at = now() where id = $1`, [user.id]);
  await logActivity({
    actorId: user.id,
    actorRole: effectiveRole,
    action: "auth.login",
    entityType: "user",
    entityId: user.id,
  });
  revalidatePath("/", "layout");

  const destination =
    next && next.startsWith("/")
      ? next
      : effectiveRole === "vendor"
        ? "/vendor"
        : effectiveRole === "customer"
          ? "/account"
          : "/admin";
  redirect(destination);
}

export async function logoutAction() {
  const user = await getCurrentUser();
  if (user) {
    await logActivity({ actorId: user.id, actorRole: user.role, action: "auth.logout", entityType: "user", entityId: user.id });
  }
  await clearSessionCookie();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function registerVendorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const proofFile = formData.get("proofOfResidenceFile");
  let initialProofUrl = String(formData.get("proofOfResidenceUrl") ?? "").trim();
  const hasProofFile = proofFile instanceof File && proofFile.size > 0;

  const raw = {
    businessName: formData.get("businessName"),
    ownerName: formData.get("ownerName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    categorySlug: formData.get("categorySlug"),
    description: formData.get("description"),
    city: formData.get("city"),
    state: formData.get("state") ?? AKWA_IBOM_STATE,
    address: formData.get("address") ?? "",
    nin: formData.get("nin") ?? "",
    proofOfResidenceType: formData.get("proofOfResidenceType") ?? "",
    proofOfResidenceUrl: initialProofUrl || (hasProofFile ? "pending-upload" : ""),
    cacRegistered: formData.get("cacRegistered") ?? "",
    cacNumber: formData.get("cacNumber") ?? "",
    logoUrl: formData.get("logoUrl") ?? "",
    coverUrl: formData.get("coverUrl") ?? "",
    acceptTerms: formData.get("acceptTerms") ?? "",
  };
  const parsed = vendorRegisterSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields", fieldErrors: formatIssues(parsed.error) };
  }

  try {
    if (hasProofFile) {
      initialProofUrl = await uploadVerificationDocument(proofFile, "vendor-kyc");
    }
    const logo = formData.get("logoFile");
    const cover = formData.get("coverFile");
    let logoUrl = parsed.data.logoUrl ?? "";
    let coverUrl = parsed.data.coverUrl ?? "";
    if (logo instanceof File && logo.size > 0) logoUrl = await uploadImage(logo, "stores/logos");
    if (cover instanceof File && cover.size > 0) coverUrl = await uploadImage(cover, "stores/covers");

    const result = await registerVendor({
      ...parsed.data,
      proofOfResidenceUrl: initialProofUrl,
      logoUrl,
      coverUrl,
    });

    const token = await createSessionToken({
      sub: result.userId,
      email: parsed.data.email.trim().toLowerCase(),
      role: "vendor",
      name: parsed.data.ownerName.trim(),
    });
    await setSessionCookie(token);
    revalidatePath("/", "layout");

    const verify = devLinks() ? `&verify=${result.verificationToken}` : "";
    redirect(`/vendor?welcome=1${verify}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: error instanceof Error ? error.message : "Registration failed. Please try again." };
  }
}

export async function registerCustomerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const nextRaw = String(formData.get("next") ?? "").trim();
  const parsed = customerRegisterSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    password: formData.get("password"),
    acceptTerms: formData.get("acceptTerms") ?? "",
  });
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields", fieldErrors: formatIssues(parsed.error) };
  }
  try {
    const result = await registerCustomer(parsed.data);
    const token = await createSessionToken({
      sub: result.userId,
      email: parsed.data.email.trim().toLowerCase(),
      role: "customer",
      name: parsed.data.fullName.trim(),
    });
    await setSessionCookie(token);
    revalidatePath("/", "layout");
    if (nextRaw && nextRaw.startsWith("/")) {
      redirect(nextRaw);
    }
    const verify = devLinks() ? `?verify=${result.verificationToken}` : "";
    redirect(`/account${verify}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: error instanceof Error ? error.message : "Registration failed" };
  }
}

export async function forgotPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Enter a valid email address" };
  const email = parsed.data.email.toLowerCase();
  const limit = rateLimit(`forgot:${email}`, 4, 300_000);
  if (!limit.allowed) return { error: "Too many requests. Try again in a few minutes." };

  const user = await systemDb.maybeOne<{ id: string; full_name: string; status: string }>(
    `select id, full_name, status from users where lower(email) = $1`,
    [email],
  );

  if (user && user.status === "active") {
    const token = await createAuthToken(user.id, "reset_password", 60 * 24);
    const link = url(`/reset-password?token=${token}`);
    await sendEmail({
      to: email,
      template: "reset_password",
      data: { name: user.full_name, link },
      dedupeKey: `reset:${token.slice(0, 16)}`,
    });
    await logActivity({ actorId: user.id, actorRole: "customer", action: "auth.reset_requested", entityType: "user", entityId: user.id });
    return {
      message: "If that email is registered, a reset link is on its way.",
      link: devLinks() ? link : undefined,
    };
  }

  return { message: "If that email is registered, a reset link is on its way." };
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields", fieldErrors: formatIssues(parsed.error) };
  }
  const record = await consumeAuthToken(parsed.data.token, "reset_password");
  if (!record) return { error: "This reset link is invalid or has expired. Request a new one." };

  const hash = await hashPassword(parsed.data.password);
  const user = await systemDb.one<{ email: string; full_name: string }>(
    `update users set password_hash = $2 where id = $1 returning email, full_name`,
    [record.user_id, hash],
  );
  await logActivity({
    actorId: record.user_id,
    actorRole: "customer",
    action: "auth.password_reset",
    entityType: "user",
    entityId: record.user_id,
  });
  await sendEmail({
    to: user.email,
    template: "account_security",
    data: { name: user.full_name, message: "Your password was changed using a reset link." },
    dedupeKey: `password-changed:${record.user_id}:${Date.now()}`,
  });
  redirect("/login?reset=1");
}

export async function verifyEmailAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  if (!token) return { error: "Missing verification token" };
  const record = await consumeAuthToken(token, "verify_email");
  if (!record) return { error: "This verification link is invalid or has expired. Sign in and request a new one." };

  await systemDb.execute(`update users set email_verified_at = now() where id = $1`, [record.user_id]);
  await logActivity({ actorId: record.user_id, action: "auth.email_verified", entityType: "user", entityId: record.user_id });
  return { message: "Email verified. Your account is fully secured." };
}

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "You need to sign in" };

  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const newPassword = String(formData.get("newPassword") ?? "");
  if (fullName.length < 3) return { error: "Enter your full name", fieldErrors: { fullName: "Name is too short" } };

  await withSystem(async (db) => {
    await db.execute(`update users set full_name = $2, phone = $3 where id = $1`, [user.id, fullName, phone || null]);
    if (newPassword) {
      if (newPassword.length < 8) throw new Error("Password must be at least 8 characters");
      await db.execute(`update users set password_hash = $2 where id = $1`, [user.id, await hashPassword(newPassword)]);
    }
    await logActivity({ actorId: user.id, actorRole: user.role, action: "profile.updated", entityType: "user", entityId: user.id }, db);
  });

  revalidatePath("/account/profile");
  revalidatePath("/vendor/store");
  return { message: "Profile updated." };
}

export async function resendVerificationAction(): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first" };
  if (user.emailVerified) return { message: "Your email is already verified." };
  const token = await createAuthToken(user.id, "verify_email", 60 * 24);
  const link = url(`/verify-email?token=${token}`);
  await sendEmail({
    to: user.email,
    template: "verify_email",
    data: { name: user.fullName, link },
    dedupeKey: `verify:${user.id}:${token.slice(0, 12)}`,
  });
  return { message: "Verification email sent.", link: devLinks() ? link : undefined };
}

export async function requestSubdomainChangeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "vendor") return { error: "Vendor account required" };
  const requested = String(formData.get("subdomain") ?? "").trim().toLowerCase();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!requested) return { error: "Enter the store address you want" };

  const { checkSubdomain } = await import("@/lib/stores");
  const check = await checkSubdomain(requested);
  if (!check.available) return { error: check.reason ?? "That address is unavailable" };

  const store = await systemDb.maybeOne<{ id: string }>(`select id from stores where owner_id = $1 limit 1`, [user.id]);
  if (!store) return { error: "Store not found" };

  const pending = await systemDb.maybeOne<{ id: string }>(
    `select id from subdomain_change_requests where store_id = $1 and status = 'pending' limit 1`,
    [store.id],
  );
  if (pending) return { error: "You already have a pending address change request." };

  await withSystem(async (db) => {
    await db.execute(
      `insert into subdomain_change_requests (store_id, requested_subdomain, reason) values ($1,$2,$3)`,
      [store.id, check.slug, reason || null],
    );
    await logActivity(
      { actorId: user.id, actorRole: "vendor", storeId: store.id, action: "subdomain.requested", entityType: "store", entityId: store.id, description: check.slug },
      db,
    );
  });
  revalidatePath("/vendor/store");
  const settings = await getSettings();
  await sendEmail({
    to: settings.support_email,
    template: "message_received",
    data: {
      name: user.fullName,
      email: user.email,
      subject: "Subdomain change request",
      message: `${user.fullName} requests the store address "${check.slug}". Reason: ${reason || "not provided"}`,
      link: "/admin/vendors",
    },
    dedupeKey: `subdomain-request:${store.id}:${check.slug}`,
  });
  return { message: "Request submitted. An administrator will review it shortly." };
}
