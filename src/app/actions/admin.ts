"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, getCurrentUser } from "@/lib/auth";
import { systemDb, withSystem } from "@/lib/db";
import { logActivity } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { retryFailedEmails, sendEmail } from "@/lib/email";
import { emailFrom, getSettings, paystackSecret, resendKey, url } from "@/lib/settings";
import {
  approveStore,
  checkSubdomain,
  deleteProductCompletely,
  deleteStoreCompletely,
  rejectStore,
  restoreStore,
  suspendStore,
} from "@/lib/stores";
import { checkPaystackCredentials } from "@/lib/payments/gateway";
import { processRefund } from "@/lib/payments";
import { adminGrantSubscription, adminWaiveSubscription } from "@/lib/subscriptions";
import { formatIssues, categorySchema } from "@/lib/validation";

export interface AdminState {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
}

async function admin() {
  return requireAdmin();
}

/* -------------------------------------------------------------------------- */
/* Stores                                                                     */
/* -------------------------------------------------------------------------- */

export async function approveStoreDecisionAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const user = await admin();
  const storeId = String(formData.get("storeId") ?? "").trim();
  if (!storeId) return { error: "Missing storefront ID." };
  if (formData.get("documentsReviewed") !== "on") {
    return {
      error:
        "Always review the uploaded Proof of Residence, NIN, and registration documents and tick the confirmation box before approving.",
    };
  }
  try {
    await approveStore(storeId, user.id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not approve storefront." };
  }
  revalidatePath("/admin");
  revalidatePath("/admin/vendors");
  revalidatePath(`/admin/vendors/${storeId}`);
  revalidatePath("/admin/messages");
  revalidatePath("/vendor");
  revalidatePath("/browse");
  revalidatePath("/");
  return { message: "Storefront approved, opened publicly, and owner notified." };
}

export async function approveStoreAction(formData: FormData) {
  const user = await admin();
  const storeId = String(formData.get("storeId") ?? "");
  await approveStore(storeId, user.id);
  revalidatePath("/admin");
  revalidatePath("/admin/vendors");
  revalidatePath(`/admin/vendors/${storeId}`);
  revalidatePath("/admin/messages");
  revalidatePath("/vendor");
  revalidatePath("/browse");
  revalidatePath("/");
}

export async function rejectStoreAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const user = await admin();
  const storeId = String(formData.get("storeId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5) return { error: "Give the vendor a clear reason (at least 5 characters)" };
  try {
    await rejectStore(storeId, user.id, reason);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not decline storefront." };
  }
  revalidatePath("/admin");
  revalidatePath("/admin/vendors");
  revalidatePath(`/admin/vendors/${storeId}`);
  revalidatePath("/admin/messages");
  revalidatePath("/vendor");
  return { message: "Storefront declined and the store owner has been notified." };
}

export async function suspendStoreAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const user = await admin();
  const storeId = String(formData.get("storeId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5) return { error: "Explain why the store is being suspended" };
  await suspendStore(storeId, user.id, reason);
  revalidatePath("/admin/vendors");
  revalidatePath(`/admin/vendors/${storeId}`);
  return { message: "Store suspended. All data has been preserved." };
}

export async function restoreStoreAction(formData: FormData) {
  const user = await admin();
  const storeId = String(formData.get("storeId") ?? "");
  await restoreStore(storeId, user.id);
  revalidatePath("/admin/vendors");
  revalidatePath(`/admin/vendors/${storeId}`);
}

export async function adminDeleteStoreAction(formData: FormData) {
  const user = await admin();
  const storeId = String(formData.get("storeId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || "Removed by platform administrator";
  const redirectTo = String(formData.get("redirectTo") ?? "").trim();
  if (!storeId) return;

  const deleted = await deleteStoreCompletely({
    storeId,
    actorId: user.id,
    actorRole: user.role,
    reason,
  });

  revalidateTag("announcements");
  revalidateTag("categories");
  revalidatePath("/", "layout");
  revalidatePath("/browse");
  revalidatePath("/stores");
  if (deleted?.storeSlug) {
    revalidatePath(`/s/${deleted.storeSlug}`, "layout");
  }
  revalidatePath("/admin");
  revalidatePath("/admin/vendors");
  revalidatePath("/admin/messages");
  revalidatePath("/admin/subscriptions");
  revalidatePath("/vendor");

  if (redirectTo.startsWith("/admin/")) {
    redirect(redirectTo);
  }
}

export async function adminDeleteProductAction(formData: FormData) {
  const user = await admin();
  const productId = String(formData.get("productId") ?? "").trim();
  const storeId = String(formData.get("storeId") ?? "").trim() || undefined;
  if (!productId) return;

  const deleted = await deleteProductCompletely({
    productId,
    storeId,
    actorId: user.id,
    actorRole: user.role,
  });

  revalidateTag("announcements");
  revalidateTag("categories");
  revalidatePath("/", "layout");
  revalidatePath("/browse");
  revalidatePath("/stores");
  if (deleted?.storeSlug) {
    revalidatePath(`/s/${deleted.storeSlug}`, "layout");
    revalidatePath(`/s/${deleted.storeSlug}/products`);
  }
  revalidatePath("/vendor");
  revalidatePath("/vendor/products");
  revalidatePath("/admin");
  if (deleted?.storeId) {
    revalidatePath(`/admin/vendors/${deleted.storeId}`);
  }
}

export async function setStoreVisibilityAction(formData: FormData) {
  await admin();
  const storeId = String(formData.get("storeId") ?? "");
  const visibility = formData.get("visibility") === "unlisted" ? "unlisted" : "public";
  await systemDb.execute(`update stores set visibility = $2 where id = $1`, [storeId, visibility]);
  revalidatePath("/admin/vendors");
  revalidatePath(`/admin/vendors/${storeId}`);
}

export async function verifyVendorKycAction(formData: FormData) {
  const user = await admin();
  const storeId = String(formData.get("storeId") ?? "");
  const decision = formData.get("decision") === "rejected" ? "rejected" : "verified";
  const note = String(formData.get("note") ?? "").trim() || null;

  const store = await systemDb.maybeOne<{ id: string; owner_id: string; name: string }>(
    `select id, owner_id, name from stores where id = $1`,
    [storeId],
  );
  if (!store) return;

  await withSystem(async (db) => {
    await db.execute(
      `insert into vendor_profiles (user_id, position, kyc_status, kyc_note, verified_at)
       values ($1, 'Owner', $2, $3, case when $2 = 'verified' then now() else null end)
       on conflict (user_id) do update set
         kyc_status = excluded.kyc_status,
         kyc_note = excluded.kyc_note,
         verified_at = case when excluded.kyc_status = 'verified' then now() else null end`,
      [store.owner_id, decision, note],
    );
    await logActivity(
      {
        actorId: user.id,
        actorRole: user.role,
        storeId: store.id,
        action: `vendor.kyc_${decision}`,
        entityType: "store",
        entityId: store.id,
        description: `KYC marked ${decision} for ${store.name}`,
      },
      db,
    );
    await notify(
      {
        userId: store.owner_id,
        storeId: store.id,
        type: "kyc_update",
        title: decision === "verified" ? "KYC verification approved" : "KYC verification needs attention",
        body:
          decision === "verified"
            ? "Your NIN, Proof of Residence, and business details have been verified."
            : note || "Please review and update your NIN / Proof of Residence in Store Profile.",
        actionUrl: "/vendor/store",
        dedupeKey: `kyc-${decision}:${store.id}:${Date.now()}`,
      },
      db,
    );
  });

  revalidatePath(`/admin/vendors/${storeId}`);
  revalidatePath("/vendor/store");
}

export async function grantSubscriptionAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const user = await admin();
  const storeId = String(formData.get("storeId") ?? "");
  const planId = String(formData.get("planId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!storeId || !planId) return { error: "Choose a plan" };
  try {
    await adminGrantSubscription({ storeId, planId, adminId: user.id, note: note || undefined });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not grant the subscription" };
  }
  revalidatePath(`/admin/vendors/${storeId}`);
  revalidatePath("/admin/subscriptions");
  return { message: "Subscription granted and the vendor notified." };
}

/**
 * Administrator waives a vendor subscription for 1–12 calendar months at ₦0.
 * Extends from the later of now() or the current expiry so remaining paid
 * time is never lost, and restores an expired storefront unless manually
 * suspended.
 */
export async function waiveSubscriptionAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const user = await admin();
  const storeId = String(formData.get("storeId") ?? "");
  const months = Number(formData.get("months") ?? "");
  const planId = String(formData.get("planId") ?? "") || null;
  const note = String(formData.get("note") ?? "").trim();
  if (!storeId) return { error: "Choose a store" };
  if (!Number.isInteger(months) || months < 1 || months > 12) {
    return { error: "Choose a waiver of 1–12 months" };
  }
  try {
    await adminWaiveSubscription({ storeId, months, planId, adminId: user.id, note: note || undefined });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not waive the subscription" };
  }
  revalidatePath(`/admin/vendors/${storeId}`);
  revalidatePath("/admin/subscriptions");
  return {
    message: `Subscription waived for ${months} month${months === 1 ? "" : "s"} and the vendor notified.`,
  };
}

/* -------------------------------------------------------------------------- */
/* Plans                                                                      */
/* -------------------------------------------------------------------------- */

export async function savePlanAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const user = await admin();
  const id = String(formData.get("planId") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim();
  const price = Number(formData.get("price") ?? 0);
  const durationDays = Number(formData.get("durationDays") ?? 30);
  const productLimit = String(formData.get("productLimit") ?? "").trim();
  const orderLimit = String(formData.get("orderLimit") ?? "").trim();
  const features = String(formData.get("features") ?? "")
    .split(/[\n,]/)
    .map((feature) => feature.trim())
    .filter(Boolean);
  const isActive = formData.get("isActive") === "on";
  const isFeatured = formData.get("isFeatured") === "on";

  if (name.length < 2) return { error: "Enter a plan name" };
  if (!Number.isFinite(price) || price < 0) return { error: "Enter a valid price" };

  try {
    await withSystem(async (db) => {
      if (id) {
        await db.execute(
          `update subscription_plans set name=$2, price=$3, duration_days=$4, product_limit=$5, order_limit=$6,
                  features=$7::jsonb, is_active=$8, is_featured=$9 where id=$1`,
          [id, name, price, durationDays, productLimit ? Number(productLimit) : null, orderLimit ? Number(orderLimit) : null, JSON.stringify(features), isActive, isFeatured],
        );
      } else {
        await db.execute(
          `insert into subscription_plans (name, slug, price, duration_days, product_limit, order_limit, features, is_active, is_featured)
           values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)`,
          [name, name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), price, durationDays, productLimit ? Number(productLimit) : null, orderLimit ? Number(orderLimit) : null, JSON.stringify(features), isActive, isFeatured],
        );
      }
      await logActivity(
        { actorId: user.id, actorRole: "admin", action: id ? "plan.updated" : "plan.created", entityType: "subscription_plan", entityId: id ?? undefined, description: name },
        db,
      );
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Plan could not be saved" };
  }
  revalidatePath("/admin/subscriptions");
  return { message: "Plan saved." };
}

/* -------------------------------------------------------------------------- */
/* Payments & refunds                                                         */
/* -------------------------------------------------------------------------- */

export async function markPaymentRefundedAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const user = await admin();
  const reference = String(formData.get("reference") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const payment = await systemDb.maybeOne<{ id: string; status: string; store_id: string | null; order_id: string | null; amount: number; payer_email: string; currency: string }>(
    `select id, status, store_id, order_id, amount, payer_email, currency from payments where reference = $1`,
    [reference],
  );
  if (!payment) return { error: "Payment not found" };
  if (payment.status !== "success") return { error: "Only successful payments can be refunded" };

  await withSystem(async (db) => {
    await db.execute(`update payments set status = 'refunded', failure_reason = $2 where id = $1`, [payment.id, reason || "Refunded by administrator"]);
    await db.execute(
      `insert into refunds (payment_id, order_id, store_id, amount, reason, status, requested_by, processed_by, processed_at)
       values ($1,$2,$3,$4,$5,'processed',$6,$6,now())`,
      [payment.id, payment.order_id, payment.store_id, payment.amount, reason || "Refunded by administrator", user.id],
    );
    if (payment.order_id) {
      await db.execute(
        `update orders set payment_status = 'refunded', status = 'cancelled', cancelled_at = now(), cancellation_reason = $2 where id = $1`,
        [payment.order_id, reason || "Refunded by administrator"],
      );
    }
    if (payment.store_id) {
      await db.execute(
        `update vendor_balances
            set lifetime_refunds = lifetime_refunds + $2,
                available_amount = greatest(available_amount - $2, 0),
                pending_amount = greatest(pending_amount - $2, 0),
                updated_at = now()
          where store_id = $1`,
        [payment.store_id, payment.amount],
      );
    }
    await logActivity(
      {
        actorId: user.id,
        actorRole: "admin",
        storeId: payment.store_id ?? undefined,
        action: "payment.refunded",
        entityType: "payment",
        entityId: payment.id,
        description: reference,
        meta: { amount: payment.amount },
      },
      db,
    );
  });

  await sendEmail({
    to: payment.payer_email,
    template: "refund_updated",
    data: {
      name: "there",
      reference,
      amount: payment.amount,
      currency: payment.currency,
      status: "processed",
      note: reason || "Refunded by the platform team",
    },
    dedupeKey: `refund-admin:${payment.id}`,
  });
  revalidatePath("/admin/payments");
  return { message: `Refund recorded for ${reference}.` };
}

/* -------------------------------------------------------------------------- */
/* Categories & feature flags                                                 */
/* -------------------------------------------------------------------------- */

export async function saveCategoryAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const user = await admin();
  const id = String(formData.get("categoryId") ?? "") || null;
  const features: Record<string, boolean> = {};
  for (const key of String(formData.get("featureKeys") ?? "").split(",").filter(Boolean)) {
    features[key] = formData.get(`feature_${key}`) === "on";
  }
  const attributes = String(formData.get("attributesJson") ?? "[]");
  const workflow = String(formData.get("workflowJson") ?? "[]");

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") ?? "",
    icon: formData.get("icon") ?? "",
    features,
    attributes: attributes,
    workflow: workflow,
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) return { error: "Check the category details", fieldErrors: formatIssues(parsed.error) };
  const data = parsed.data;
  const sortOrder = Number(formData.get("sortOrder") ?? 0) || 0;
  let attributesParsed: unknown = [];
  let workflowParsed: unknown = [];
  try {
    attributesParsed = JSON.parse(data.attributes || "[]");
  } catch {
    return { error: "Category attributes must be valid JSON" };
  }
  try {
    workflowParsed = JSON.parse(data.workflow || "[]");
  } catch {
    return { error: "Workflow must be valid JSON" };
  }
  if (!Array.isArray(attributesParsed) || !Array.isArray(workflowParsed)) {
    return { error: "Attributes and workflow must be JSON arrays" };
  }

  try {
    await withSystem(async (db) => {
      if (id) {
        await db.execute(
          `update store_categories set name=$2, slug=$3, description=$4, icon=$5, sort_order=$6, features=$7::jsonb,
                  attributes=$8::jsonb, workflow=$9::jsonb, is_active=$10 where id=$1`,
          [id, data.name, data.slug, data.description || null, data.icon || null, sortOrder, JSON.stringify(data.features), JSON.stringify(attributesParsed), JSON.stringify(workflowParsed), data.isActive],
        );
      } else {
        await db.execute(
          `insert into store_categories (name, slug, description, icon, sort_order, features, attributes, workflow, is_active)
           values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9)`,
          [data.name, data.slug, data.description || null, data.icon || null, sortOrder, JSON.stringify(data.features), JSON.stringify(attributesParsed), JSON.stringify(workflowParsed), data.isActive],
        );
      }
      await logActivity(
        { actorId: user.id, actorRole: "admin", action: id ? "category.updated" : "category.created", entityType: "store_category", entityId: id ?? undefined, description: data.name },
        db,
      );
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Category could not be saved" };
  }
  revalidateTag("categories");
  revalidatePath("/admin/categories");
  revalidatePath("/browse");
  return { message: "Category saved." };
}

export async function toggleCategoryAction(formData: FormData) {
  await admin();
  const id = String(formData.get("categoryId") ?? "");
  const active = formData.get("active") === "true";
  await systemDb.execute(`update store_categories set is_active = $2 where id = $1`, [id, active]);
  revalidateTag("categories");
  revalidatePath("/admin/categories");
  revalidatePath("/browse");
}

/* -------------------------------------------------------------------------- */
/* Subdomain requests                                                         */
/* -------------------------------------------------------------------------- */

export async function reviewSubdomainRequestAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const user = await admin();
  const requestId = String(formData.get("requestId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!["approved", "rejected"].includes(decision)) return { error: "Choose approve or reject" };

  const request = await systemDb.maybeOne<{
    id: string;
    store_id: string;
    requested_subdomain: string;
    status: string;
    store_name: string;
    owner_id: string;
    owner_email: string;
    current_slug: string;
  }>(
    `select r.id, r.store_id, r.requested_subdomain, r.status, s.name as store_name, s.owner_id,
            s.slug as current_slug, u.email as owner_email
       from subdomain_change_requests r join stores s on s.id = r.store_id join users u on u.id = s.owner_id
      where r.id = $1`,
    [requestId],
  );
  if (!request) return { error: "Request not found" };
  if (request.status !== "pending") return { error: "This request has already been reviewed" };

  if (decision === "approved") {
    const check = await checkSubdomain(request.requested_subdomain, request.store_id);
    if (!check.available) return { error: check.reason ?? "That address is no longer available" };
    await withSystem(async (db) => {
      await db.execute(`update stores set slug = $2 where id = $1`, [request.store_id, check.slug]);
      await db.execute(
        `update subdomain_change_requests set status='approved', admin_note=$2, reviewed_by=$3, reviewed_at=now() where id=$1`,
        [requestId, note || null, user.id],
      );
      await logActivity(
        { actorId: user.id, actorRole: "admin", storeId: request.store_id, action: "subdomain.approved", entityType: "store", entityId: request.store_id, description: `${request.current_slug} → ${check.slug}` },
        db,
      );
    });
    await sendEmail({
      to: request.owner_email,
      template: "store_reactivated",
      data: { storeUrl: url(`/s/${check.slug}`) },
      dedupeKey: `subdomain-approved:${requestId}`,
    });
  } else {
    await withSystem(async (db) => {
      await db.execute(
        `update subdomain_change_requests set status='rejected', admin_note=$2, reviewed_by=$3, reviewed_at=now() where id=$1`,
        [requestId, note || null, user.id],
      );
      await logActivity(
        { actorId: user.id, actorRole: "admin", storeId: request.store_id, action: "subdomain.rejected", entityType: "store", entityId: request.store_id, description: note },
        db,
      );
    });
  }

  await notify({
    userId: request.owner_id,
    storeId: request.store_id,
    type: `subdomain_${decision}`,
    title: decision === "approved" ? "Store address changed" : "Store address request rejected",
    body: decision === "approved" ? `Your storefront is now live at ${request.requested_subdomain}.` : note || "Contact support for details.",
    actionUrl: "/vendor/store",
    dedupeKey: `subdomain-${decision}:${requestId}`,
  });

  revalidatePath("/admin/subdomains");
  revalidatePath("/admin/vendors");
  return { message: `Request ${decision}.` };
}

/* -------------------------------------------------------------------------- */
/* Messages                                                                   */
/* -------------------------------------------------------------------------- */

export async function adminMessageAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const user = await admin();
  const messageId = String(formData.get("messageId") ?? "");
  const status = String(formData.get("status") ?? "");
  const reply = String(formData.get("reply") ?? "").trim();
  if (!["resolved", "closed", "open"].includes(status)) return { error: "Choose a status" };

  const message = await systemDb.maybeOne<{ id: string; store_id: string | null; sender_email: string; subject: string; sender_name: string; store_name: string | null }>(
    `select m.id, m.store_id, m.sender_email, m.subject, m.sender_name, s.name as store_name
       from customer_messages m left join stores s on s.id = m.store_id where m.id = $1`,
    [messageId],
  );
  if (!message) return { error: "Message not found" };

  await withSystem(async (db) => {
    await db.execute(`update customer_messages set status = $2 where id = $1`, [messageId, status]);
    if (reply) {
      await db.execute(
        `insert into customer_messages (store_id, sender_name, sender_email, sender_role, category, subject, body, parent_id, status)
         values ($1,$2,$3,'admin','support',$4,$5,$6,'awaiting_customer')`,
        [message.store_id, "Ibom Vendors Hub support", (await getSettings()).support_email, `Re: ${message.subject}`, reply, messageId],
      );
    }
    await logActivity(
      { actorId: user.id, actorRole: "admin", storeId: message.store_id ?? undefined, action: "message.updated", entityType: "customer_message", entityId: messageId, description: status },
      db,
    );
  });

  if (reply) {
    await sendEmail({
      to: message.sender_email,
      template: "message_received",
      data: { name: message.sender_name, email: message.sender_email, storeName: message.store_name ?? "Ibom Vendors Hub", subject: `Re: ${message.subject}`, message: reply },
      dedupeKey: `admin-reply:${messageId}:${Date.now()}`,
    });
  }
  revalidatePath("/admin/messages");
  return { message: reply ? "Reply sent." : "Message updated." };
}

/* -------------------------------------------------------------------------- */
/* Platform settings                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Stores the Google OAuth client used by "Continue with Google".
 *
 * The pair lives in platform_settings so the owner can connect (or rotate) it
 * from the dashboard without a redeploy; the secret is never rendered back to
 * the browser. A blank secret keeps the stored one, which is how the form shows
 * "already saved" without shipping the value.
 */
export async function saveGoogleSignInAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const user = await admin();
  const clientId = String(formData.get("clientId") ?? "").trim();
  const clientSecret = String(formData.get("clientSecret") ?? "").trim();
  const enabled = formData.get("enabled") === "on";

  if (clientId && !clientId.endsWith(".apps.googleusercontent.com")) {
    return {
      error:
        "That does not look like a client ID. Google OAuth web clients end with .apps.googleusercontent.com — copy it from Google Cloud Console → APIs & Services → Credentials.",
    };
  }

  const current = await systemDb.maybeOne<{ google_client_secret: string | null }>(
    `select google_client_secret from platform_settings where id = 1`,
  );
  const hasSecret = Boolean(clientSecret || current?.google_client_secret || process.env.GOOGLE_CLIENT_SECRET);
  if (clientId && !hasSecret) {
    return { error: "Add the client secret too — Google needs both halves of the pair to complete the exchange." };
  }

  await systemDb.execute(
    `update platform_settings
        set google_client_id = $1,
            google_client_secret = case when $1::text is null then null
                                        else coalesce(nullif($2, ''), google_client_secret) end,
            google_signin_enabled = $3,
            updated_at = now()
      where id = 1`,
    [clientId || null, clientSecret, enabled],
  );

  await logActivity({
    actorId: user.id,
    actorRole: "admin",
    action: "integrations.google_signin_saved",
    entityType: "platform_settings",
    entityId: "1",
    description: clientId
      ? `Google sign-in ${enabled ? "enabled" : "disabled"} with client ${clientId.slice(0, 18)}…`
      : "Google sign-in credentials cleared",
    meta: { clientIdSuffix: clientId.slice(-28), secretUpdated: Boolean(clientSecret), enabled },
  });

  revalidateTag("settings");
  revalidatePath("/admin/settings");
  revalidatePath("/login");
  revalidatePath("/register/customer");

  // Report the real outcome, re-read from the row (getSettings is memoised for
  // this request and would still hold the pre-save values).
  const saved = await systemDb.maybeOne<{
    google_client_id: string | null;
    google_client_secret: string | null;
    google_signin_enabled: boolean;
  }>(`select google_client_id, google_client_secret, google_signin_enabled from platform_settings where id = 1`);

  if (!saved?.google_client_id) return { message: "Google sign-in credentials cleared." };
  if (!saved.google_signin_enabled) {
    return { message: "Saved, but the button stays hidden while this switch is off." };
  }
  if (!saved.google_client_secret && !process.env.GOOGLE_CLIENT_SECRET) {
    return { error: "Client ID saved, but there is no client secret yet, so the button stays hidden. Add the secret and save again." };
  }
  return {
    message:
      "Live. “Continue with Google” now appears on the sign-in and sign-up pages — check it end to end in a private window.",
  };
}

export async function savePlatformSettingsAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const user = await getCurrentUser();
  if (!user || !["admin", "super_admin"].includes(user.role)) return { error: "Administrator only" };

  const str = (key: string) => String(formData.get(key) ?? "").trim();
  const commission = Number(formData.get("commissionRate") ?? 5);
  if (!Number.isFinite(commission) || commission < 0 || commission > 50) return { error: "Commission must be between 0 and 50%" };

  try {
    await withSystem(async (db) => {
      await db.execute(
        `update platform_settings set
           platform_name=$1, tagline=$2, support_email=$3, support_phone=$4, main_domain=$5,
           commission_rate=$6, default_trial_days=$7, grace_period_days=$8,
           require_vendor_approval=$9, payments_enabled=$10, sandbox_payments=$11,
           maintenance_mode=$12, paystack_public_key=$13,
           paystack_secret_key=coalesce(nullif($14,''), paystack_secret_key), email_from=$15, updated_at=now()
         where id = 1`,
        [
          str("platformName") || "Ibom Vendors Hub",
          str("tagline") || "Every business. One address.",
          str("supportEmail") || null,
          str("supportPhone") || null,
          str("mainDomain") || "localhost:3000",
          commission,
          Number(formData.get("trialDays") ?? 14),
          Number(formData.get("graceDays") ?? 0),
          formData.get("requireApproval") === "on",
          formData.get("paymentsEnabled") === "on",
          formData.get("sandboxPayments") === "on",
          formData.get("maintenanceMode") === "on",
          str("paystackPublicKey") || null,
          str("paystackSecretKey") || null,
          str("emailFrom") || null,
        ],
      );
      await logActivity(
        { actorId: user.id, actorRole: "admin", action: "settings.updated", entityType: "platform_settings", entityId: "1" },
        db,
      );
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Settings could not be saved" };
  }
  revalidateTag("settings");
  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return { message: "Platform settings saved." };
}

/* -------------------------------------------------------------------------- */
/* Transactional email                                                        */
/* -------------------------------------------------------------------------- */

export async function sendTestEmailAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const user = await admin();
  const to = (String(formData.get("to") ?? "").trim() || user.email).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { error: "Enter a valid email address" };

  const settings = await getSettings();
  if (!resendKey(settings)) {
    return { error: "No email provider configured. Set RESEND_API_KEY (or save one in Platform settings) and redeploy." };
  }

  const result = await sendEmail({
    to,
    template: "provider_test",
    data: {
      name: user.fullName || user.email,
      message: `This is a test message from ${emailFrom(settings)}. If you can read this, transactional email is delivering.`,
      note: `Sent by ${user.email} from Admin → Emails.`,
    },
  });

  await logActivity({
    actorId: user.id,
    actorRole: "admin",
    action: "email.test_sent",
    entityType: "email_log",
    entityId: "id" in result ? result.id ?? null : null,
    description: `Test email to ${to}`,
    meta: { to, result: JSON.parse(JSON.stringify(result)) },
  });

  if ("error" in result && result.error) {
    return {
      error:
        result.error.startsWith("Resend 403")
          ? `Resend rejected the send — the from domain is not verified yet. ${result.error}`
          : `Provider rejected the message: ${result.error}`,
    };
  }
  if ("skipped" in result && result.skipped) {
    return { error: `Message was not sent (${result.reason}).` };
  }
  revalidatePath("/admin/emails");
  return { message: `Resend accepted the test message for ${to}. Delivery status is in the log below.` };
}

export async function retryFailedEmailsAction() {
  const user = await admin();
  const result = await retryFailedEmails(30);
  await logActivity({
    actorId: user.id,
    actorRole: "admin",
    action: "email.retried",
    entityType: "email_log",
    description: `Retried ${result.retried} failed message(s), ${result.sent} delivered`,
    meta: result,
  });
  revalidatePath("/admin/emails");
  redirect(`/admin/emails?retried=${result.sent}&attempted=${result.retried}`);
}

/* -------------------------------------------------------------------------- */
/* Payment gateway                                                            */
/* -------------------------------------------------------------------------- */

export async function verifyPaystackAction(_prev: AdminState, _formData: FormData): Promise<AdminState> {
  const user = await admin();
  const settings = await getSettings();
  const secret = paystackSecret(settings);
  if (!secret) {
    return { error: "No Paystack secret key configured. Add PAYSTACK_SECRET_KEY to the environment or save one in Platform settings." };
  }

  const result = await checkPaystackCredentials(secret);
  await logActivity({
    actorId: user.id,
    actorRole: "admin",
    action: "payments.gateway_checked",
    entityType: "platform_settings",
    entityId: "1",
    description: result.ok
      ? `Paystack key accepted (${result.balances?.map((row) => `${row.currency} ${row.balance}`).join(", ") || "no balance rows"})`
      : `Paystack key rejected — ${result.error ?? "unknown error"}`,
    meta: { ok: result.ok, error: result.error ?? null, balances: result.balances ?? [] },
  });

  if (!result.ok) return { error: `Paystack rejected the secret key — ${result.error ?? "unknown error"}` };
  revalidatePath("/admin/payments");
  const balances = result.balances?.length
    ? result.balances.map((row) => `${row.currency} ${row.balance.toLocaleString("en-NG")}`).join(" · ")
    : "no settled balance yet";
  return { message: `The secret key authenticates with Paystack. Account balance: ${balances}.` };
}

export async function settleVendorPayoutAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const user = await admin();
  const payoutId = String(formData.get("payoutId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim(); // "paid" | "failed"
  const reference = String(formData.get("reference") ?? "").trim() || null;
  const adminNote = String(formData.get("note") ?? "").trim() || null;

  if (!payoutId || (decision !== "paid" && decision !== "failed")) {
    return { error: "Invalid payout settlement action." };
  }

  try {
    await withSystem(async (db) => {
      const payout = await db.maybeOne<{
        id: string;
        store_id: string;
        amount: number;
        status: string;
        bank_name: string | null;
        account_number: string | null;
        account_name: string | null;
        owner_id: string;
        store_name: string;
      }>(
        `select p.id, p.store_id, p.amount::float8 as amount, p.status,
                p.bank_name, p.account_number, p.account_name,
                s.owner_id, s.name as store_name
           from vendor_payouts p
           join stores s on s.id = p.store_id
          where p.id = $1
          for update of p`,
        [payoutId],
      );

      if (!payout) throw new Error("Payout request not found.");
      if (payout.status !== "pending" && payout.status !== "processing") {
        throw new Error(`This payout request is already marked ${payout.status}.`);
      }

      if (decision === "paid") {
        await db.execute(
          `update vendor_payouts
              set status = 'paid',
                  reference = coalesce($2, reference),
                  notes = coalesce($3, notes),
                  processed_by = $4,
                  processed_at = now()
            where id = $1`,
          [payoutId, reference, adminNote, user.id],
        );

        await db.execute(
          `insert into vendor_balances (store_id, last_payout_at, updated_at)
           values ($1, now(), now())
           on conflict (store_id) do update
             set last_payout_at = now(),
                 updated_at = now()`,
          [payout.store_id],
        );

        await notify(
          {
            userId: payout.owner_id,
            storeId: payout.store_id,
            type: "payout_paid",
            title: `Payout Sent: ₦${Number(payout.amount).toLocaleString()}`,
            body: `₦${Number(payout.amount).toLocaleString()} has been transferred to ${payout.bank_name ?? "your bank account"} (${payout.account_number ?? ""})${reference ? ` · Ref: ${reference}` : ""}.`,
            actionUrl: "/vendor/payouts",
            dedupeKey: `payout-paid:${payout.id}`,
          },
          db,
        );
      } else {
        await db.execute(
          `update vendor_payouts
              set status = 'failed',
                  notes = coalesce($2, notes),
                  processed_by = $3,
                  processed_at = now()
            where id = $1`,
          [payoutId, adminNote ?? "Returned to available wallet balance", user.id],
        );

        await db.execute(
          `insert into vendor_balances (store_id, available_amount, updated_at)
           values ($1, $2, now())
           on conflict (store_id) do update
             set available_amount = vendor_balances.available_amount + excluded.available_amount,
                 updated_at = now()`,
          [payout.store_id, payout.amount],
        );

        await notify(
          {
            userId: payout.owner_id,
            storeId: payout.store_id,
            type: "payout_returned",
            title: `Payout Returned to Wallet: ₦${Number(payout.amount).toLocaleString()}`,
            body: `Your payout request was returned to your available wallet balance${adminNote ? `: ${adminNote}` : "."}`,
            actionUrl: "/vendor/payouts",
            dedupeKey: `payout-failed:${payout.id}`,
          },
          db,
        );
      }

      await logActivity(
        {
          actorId: user.id,
          actorRole: "admin",
          storeId: payout.store_id,
          action: decision === "paid" ? "payout.paid" : "payout.returned",
          entityType: "payout",
          entityId: payout.id,
          description:
            decision === "paid"
              ? `Marked payout of ₦${Number(payout.amount).toLocaleString()} to ${payout.store_name} as paid${reference ? ` (${reference})` : ""}`
              : `Returned payout of ₦${Number(payout.amount).toLocaleString()} back to ${payout.store_name} available wallet`,
        },
        db,
      );
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update payout status" };
  }

  revalidatePath("/admin/payments");
  revalidatePath("/vendor");
  revalidatePath("/vendor/payouts");
  return {
    message:
      decision === "paid"
        ? "Payout marked as paid and vendor notified."
        : "Payout cancelled and funds returned to vendor's available wallet.",
  };
}

export async function reviewRefundAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const user = await admin();
  const refundId = String(formData.get("refundId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || undefined;
  if (!refundId || (decision !== "approve" && decision !== "reject")) {
    return { error: "Invalid refund decision." };
  }
  try {
    await processRefund(refundId, user.id, decision === "approve", note);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not process refund." };
  }
  revalidatePath("/admin/payments");
  revalidatePath("/admin");
  return { message: decision === "approve" ? "Refund processed." : "Refund request rejected." };
}

