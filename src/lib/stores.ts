import { isUniqueViolation, systemDb, withSystem } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { isReservedSubdomain, normaliseSubdomain } from "@/lib/domains";
import { AKWA_IBOM_STATE, isAkwaIbomState, proofOfResidenceLabel } from "@/lib/akwa-ibom";
import { getSettings } from "@/lib/settings";
import { logActivity } from "@/lib/audit";
import { notify, notifyAdmins } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { url } from "@/lib/settings";

export interface SubdomainCheck {
  available: boolean;
  slug: string;
  suggestedSlug?: string;
  reason?: string;
}

/** Validate + reserve-check a business-name based subdomain. */
export async function checkSubdomain(name: string, excludeStoreId?: string): Promise<SubdomainCheck> {
  const slug = normaliseSubdomain(name);
  if (!slug || slug.length < 3) {
    return { available: false, slug, reason: "Business name must contain at least 3 letters or numbers" };
  }
  if (slug.length > 48) {
    return { available: false, slug, reason: "Business name is too long for a store address" };
  }
  if (isReservedSubdomain(slug)) {
    return { available: false, slug, reason: "This address is reserved by the platform" };
  }

  const existing = await systemDb.maybeOne<{ hit: number }>(
    `select 1 as hit from stores s
      where (lower(s.slug) = lower($1) or exists (select 1 from store_domains d where lower(d.subdomain) = lower($1)))
        and ($2::uuid is null or s.id <> $2::uuid)
      union all
     select 1 as hit from reserved_subdomains r where lower(r.name) = lower($1)
     limit 1`,
    [slug, excludeStoreId ?? null],
  );
  if (existing) {
    return {
      available: false,
      slug,
      reason: "That store address is already taken — try a variation of your business name",
    };
  }

  const pending = await systemDb.maybeOne<{ id: string }>(
    `select id from subdomain_change_requests
      where lower(requested_subdomain) = lower($1) and status = 'pending' limit 1`,
    [slug],
  );
  if (pending) {
    return { available: false, slug, reason: "That store address is reserved by another request" };
  }

  return { available: true, slug };
}

/** Resolve an available subdomain for a business name, using city or numeric suffix if the exact slug is taken/reserved. */
export async function resolveAvailableSubdomain(name: string, city?: string): Promise<SubdomainCheck> {
  const direct = await checkSubdomain(name);
  if (direct.available) return direct;

  const baseRaw = normaliseSubdomain(name).slice(0, 36);
  const citySlug = normaliseSubdomain(city || "ibom").slice(0, 10) || "ibom";
  if (!baseRaw || baseRaw.length < 2) {
    return direct;
  }

  const candidates: string[] = [];
  if (citySlug) candidates.push(`${baseRaw}-${citySlug}`);
  candidates.push(`${baseRaw}-store`, `${baseRaw}-hub`);
  for (let i = 2; i <= 15; i += 1) {
    candidates.push(`${baseRaw}-${i}`);
  }

  for (const candidate of candidates) {
    const check = await checkSubdomain(candidate);
    if (check.available) {
      return {
        available: false,
        slug: direct.slug,
        suggestedSlug: check.slug,
        reason: direct.reason,
      };
    }
  }
  return direct;
}

/** Find a free variation (used only when the platform decides to auto-suffix). */
export async function suggestSubdomains(name: string) {
  const base = normaliseSubdomain(name).slice(0, 40);
  if (!base) return [];
  const candidates = [base, `${base}-uyo`, `${base}-store`];
  for (let i = 2; i <= 8; i += 1) candidates.push(`${base}-${i}`);
  const free: string[] = [];
  for (const candidate of candidates) {
    const check = await checkSubdomain(candidate);
    if (check.available && !free.includes(check.slug)) free.push(check.slug);
    if (free.length >= 3) break;
  }
  return free;
}

export interface RegisterVendorInput {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  password: string;
  categorySlug: string;
  description: string;
  city: string;
  state: string;
  address?: string;
  nin: string;
  proofOfResidenceType: string;
  proofOfResidenceUrl: string;
  cacRegistered: "yes" | "no" | boolean;
  cacNumber?: string;
  logoUrl?: string;
  coverUrl?: string;
}

export interface RegisterVendorResult {
  userId: string;
  storeId: string;
  slug: string;
  status: string;
  trialEndsAt: string | null;
  verificationToken: string;
  planName: string;
}

export async function registerVendor(input: RegisterVendorInput): Promise<RegisterVendorResult> {
  if (!isAkwaIbomState(input.state)) {
    throw new Error("Every vendor on Ibom Vendors Hub must be located in Akwa Ibom State.");
  }
  const cacRegistered = input.cacRegistered === true || input.cacRegistered === "yes";
  const cacNumber = cacRegistered ? (input.cacNumber ?? "").trim().toUpperCase() : null;
  if (cacRegistered && !cacNumber) {
    throw new Error("Enter your CAC registration number.");
  }

  const settings = await getSettings();
  const email = input.email.trim().toLowerCase();
  const category = await systemDb.maybeOne<{ id: string; slug: string; name: string }>(
    `select id, slug, name from store_categories where slug = $1 and is_active = true`,
    [input.categorySlug],
  );
  if (!category) throw new Error("Choose a valid business category");

  const resolved = await resolveAvailableSubdomain(input.businessName, input.city);
  const chosenSlug = resolved.available ? resolved.slug : resolved.suggestedSlug;
  if (!chosenSlug) {
    throw new Error(resolved.reason ?? "Business name must contain at least 3 letters or numbers");
  }

  const existingUser = await systemDb.maybeOne<{
    id: string;
    role: string;
    status: string;
  }>(`select id, role, status from users where lower(email) = $1`, [email]);

  if (existingUser) {
    if (existingUser.status !== "active") {
      throw new Error("This account has been suspended. Please contact support.");
    }
    if (existingUser.role === "admin" || existingUser.role === "super_admin") {
      throw new Error("Admin accounts cannot be converted into vendor accounts. Please use a separate business email.");
    }
    const existingStore = await systemDb.maybeOne<{ id: string; name: string }>(
      `select id, name from stores where owner_id = $1 limit 1`,
      [existingUser.id],
    );
    if (existingStore) {
      throw new Error(
        `A storefront (${existingStore.name}) is already registered with this email. Please sign in to manage your store.`,
      );
    }
  }

  const passwordHash = await hashPassword(input.password);
  const status = "pending";
  const defaultTrialDays = Math.max(settings.default_trial_days || 14, 14);
  const proofLabel = proofOfResidenceLabel(input.proofOfResidenceType);
  const cacSummary = cacRegistered ? `Registered (${cacNumber})` : "Not registered";

  const trialPlan = await systemDb.maybeOne<{
    id: string;
    name: string;
    trial_days: number;
    duration_days: number;
  }>(
    `select id, name, trial_days, duration_days from subscription_plans
      where is_active = true order by trial_days desc, price asc limit 1`,
  );

  const result = await withSystem(async (db) => {
    const user = existingUser
      ? await db.one<{ id: string }>(
          `update users
              set password_hash = $2,
                  full_name = $3,
                  phone = $4,
                  role = 'vendor',
                  updated_at = now()
            where id = $1
            returning id`,
          [existingUser.id, passwordHash, input.ownerName.trim(), input.phone.trim()],
        )
      : await db.one<{ id: string }>(
          `insert into users (email, password_hash, full_name, phone, role, email_verified_at)
           values ($1,$2,$3,$4,'vendor', null)
           returning id`,
          [email, passwordHash, input.ownerName.trim(), input.phone.trim()],
        );

    await db.execute(
      `insert into vendor_profiles
         (user_id, position, nin, proof_of_residence_type, proof_of_residence_url, cac_registered, cac_number, kyc_status)
       values ($1, 'Owner', $2, $3, $4, $5, $6, 'submitted')
       on conflict (user_id) do update
         set nin = excluded.nin,
             proof_of_residence_type = excluded.proof_of_residence_type,
             proof_of_residence_url = excluded.proof_of_residence_url,
             cac_registered = excluded.cac_registered,
             cac_number = excluded.cac_number,
             kyc_status = 'submitted',
             updated_at = now()`,
      [
        user.id,
        input.nin.trim(),
        input.proofOfResidenceType.trim(),
        input.proofOfResidenceUrl,
        cacRegistered,
        cacNumber,
      ],
    );
    await db.execute(
      `insert into user_roles (user_id, role) values ($1,'vendor') on conflict do nothing`,
      [user.id],
    );

    const store = await db.one<{ id: string; slug: string; status: string; review_deadline_at: string }>(
      `insert into stores
         (owner_id, category_id, name, slug, tagline, description, logo_url, cover_url,
          email, phone, city, state, address, country, status, approved_at,
          review_deadline_at, access_until, delivery_fee, prep_time_minutes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
               null,
               now() + interval '48 hours',
               case when $16::boolean then null else now() + make_interval(days => $17) end,
               1500, 30)
       returning id, slug, status, review_deadline_at`,
      [
        user.id,
        category.id,
        input.businessName.trim(),
        chosenSlug,
        input.description.slice(0, 120),
        input.description.trim(),
        input.logoUrl || null,
        input.coverUrl || null,
        email,
        input.phone.trim(),
        input.city.trim(),
        AKWA_IBOM_STATE,
        input.address?.trim() || null,
        settings.country,
        status,
        Boolean(trialPlan),
        defaultTrialDays,
      ],
    );

    let trialEndsAt: string | null = null;
    let planName = "Free Trial";
    if (trialPlan) {
      const trialDays = trialPlan.trial_days > 0 ? trialPlan.trial_days : defaultTrialDays;
      planName = trialPlan.name;
      const sub = await db.one<{ id: string; expires_at: string }>(
        `insert into subscriptions (store_id, plan_id, status, started_at, expires_at)
         values ($1,$2,'trialing', now(), now() + make_interval(days => $3))
         returning id, expires_at`,
        [store.id, trialPlan.id, trialDays],
      );
      trialEndsAt = sub.expires_at;
      await db.execute(
        `insert into subscription_history (subscription_id, store_id, from_status, to_status, to_expires_at, note)
         values ($1,$2,'none','trialing',$3,$4)`,
        [sub.id, store.id, sub.expires_at, `${trialDays}-day free trial`],
      );
    }

    await db.execute(
      `insert into vendor_balances (store_id) values ($1) on conflict (store_id) do nothing`,
      [store.id],
    );

    const adminMessageBody = [
      `New Storefront Registration — 48-Hour Verification Required`,
      ``,
      `Business Name: ${input.businessName.trim()}`,
      `Subdomain Slug: ${chosenSlug}`,
      `Category: ${category.name}`,
      `Owner Name: ${input.ownerName.trim()}`,
      `Owner Email: ${email}`,
      `Owner Phone / WhatsApp: ${input.phone.trim()}`,
      `Location: ${[input.address?.trim(), input.city.trim(), AKWA_IBOM_STATE].filter(Boolean).join(", ")}`,
      `NIN: ${input.nin.trim()}`,
      `CAC Registration: ${cacSummary}`,
      `Proof of Residence: ${proofLabel}`,
      `48-Hour Decision Deadline: ${new Date(store.review_deadline_at).toUTCString()}`,
      ``,
      `Please review all uploaded registration documents before approving or declining this storefront.`,
    ].join("\n");

    await db.execute(
      `insert into customer_messages
         (store_id, customer_id, sender_name, sender_email, sender_role, category, subject, body, status)
       values ($1,$2,$3,$4,'vendor','store_approval',$5,$6,'open')`,
      [
        store.id,
        user.id,
        input.ownerName.trim(),
        email,
        `New Storefront Review (48h Timer): ${input.businessName.trim()}`,
        adminMessageBody,
      ],
    );

    await logActivity(
      {
        actorId: user.id,
        actorRole: "vendor",
        storeId: store.id,
        action: "vendor.registered",
        entityType: "store",
        entityId: store.id,
        description: `${input.businessName} registered (${category.name}) — awaiting 48h admin document review`,
        meta: {
          category: category.slug,
          slug: chosenSlug,
          reviewDeadlineAt: store.review_deadline_at,
          upgradedExistingUser: Boolean(existingUser),
        },
      },
      db,
    );

    await notify(
      {
        userId: user.id,
        storeId: store.id,
        type: "welcome",
        title: "Application received — 48-hour review started",
        body: `We received your registration & KYC documents for ${input.businessName.trim()}. Our admin team will review and notify you within 48 hours. You can already add products!`,
        actionUrl: "/vendor",
        dedupeKey: `welcome:${user.id}:${store.id}`,
      },
      db,
    );

    await notifyAdmins(
      {
        storeId: store.id,
        type: "vendor_registered",
        title: `48h Storefront Review: ${input.businessName.trim()}`,
        body: `Owner: ${input.ownerName.trim()} (${email}, ${input.phone.trim()}) · ${input.city.trim()}, Akwa Ibom · Review uploaded documents & approve or decline within 48 hours.`,
        actionUrl: `/admin/vendors/${store.id}`,
        dedupeKey: `vendor-registered:${store.id}`,
      },
      db,
    );

    return {
      userId: user.id,
      storeId: store.id,
      slug: store.slug,
      status: store.status,
      reviewDeadlineAt: store.review_deadline_at,
      trialEndsAt,
      planName,
    };
  });

  // Verification + pending-review + admin notification emails (outside the transaction — never block registration).
  let token = "";
  try {
    const { createAuthToken } = await import("@/lib/auth");
    token = await createAuthToken(result.userId, "verify_email", 60 * 24);
    const verifyLink = url(`/verify-email?token=${token}`);
    const deadlineLabel = new Date(result.reviewDeadlineAt).toUTCString();

    await sendEmail({
      to: email,
      template: "verify_email",
      data: { name: input.ownerName, link: verifyLink },
      dedupeKey: `verify:${result.userId}:${token.slice(0, 12)}`,
    });
    await sendEmail({
      to: email,
      template: "vendor_pending_review",
      data: {
        name: input.ownerName,
        storeName: input.businessName,
        storeUrl: url(`/s/${result.slug}`),
        planName: result.planName,
        reviewDeadline: deadlineLabel,
      },
      dedupeKey: `vendor-pending:${result.storeId}`,
    });

    const adminEmails = new Set<string>();
    if (settings.support_email) adminEmails.add(settings.support_email.toLowerCase());
    if (process.env.ADMIN_EMAIL) adminEmails.add(process.env.ADMIN_EMAIL.toLowerCase());
    const dbAdmins = await systemDb.query<{ email: string }>(
      `select email from users where role in ('admin','super_admin') and status = 'active'`,
    );
    for (const row of dbAdmins) {
      if (row.email) adminEmails.add(row.email.toLowerCase());
    }

    for (const adminEmail of adminEmails) {
      await sendEmail({
        to: adminEmail,
        template: "admin_new_vendor",
        data: {
          storeName: input.businessName,
          storeUrl: url(`/s/${result.slug}`),
          name: input.ownerName,
          email,
          phone: input.phone.trim(),
          location: `${[input.address?.trim(), input.city.trim(), AKWA_IBOM_STATE].filter(Boolean).join(", ")}`,
          nin: input.nin.trim(),
          cacInfo: cacSummary,
          proofType: proofLabel,
          reviewDeadline: deadlineLabel,
          reviewUrl: url(`/admin/vendors/${result.storeId}`),
        },
        dedupeKey: `admin-new-vendor:${result.storeId}:${adminEmail}`,
      });
    }
  } catch (emailErr) {
    console.error("[registerVendor] Non-fatal post-registration email error:", emailErr);
  }

  return {
    ...result,
    verificationToken: token,
  };
}

export interface RegisterCustomerInput {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
}

export async function registerCustomer(input: RegisterCustomerInput) {
  const email = input.email.trim().toLowerCase();
  const existing = await systemDb.maybeOne<{ id: string }>(
    `select id from users where lower(email) = $1`,
    [email],
  );
  if (existing) throw new Error("An account with this email already exists. Please sign in instead.");

  const passwordHash = await hashPassword(input.password);
  const userId = await withSystem(async (db) => {
    const user = await db.one<{ id: string }>(
      `insert into users (email, password_hash, full_name, phone, role)
       values ($1,$2,$3,$4,'customer') returning id`,
      [email, passwordHash, input.fullName.trim(), input.phone?.trim() || null],
    );
    await db.execute(`insert into customer_profiles (user_id) values ($1)`, [user.id]);
    await db.execute(`insert into user_roles (user_id, role) values ($1,'customer') on conflict do nothing`, [user.id]);
    await logActivity(
      { actorId: user.id, actorRole: "customer", action: "customer.registered", entityType: "user", entityId: user.id },
      db,
    );
    return user.id;
  });

  const { createAuthToken } = await import("@/lib/auth");
  const token = await createAuthToken(userId, "verify_email", 60 * 24);
  await sendEmail({
    to: email,
    template: "verify_email",
    data: { name: input.fullName, link: url(`/verify-email?token=${token}`) },
    dedupeKey: `verify:${userId}:${token.slice(0, 12)}`,
  });
  await sendEmail({
    to: email,
    template: "customer_welcome",
    data: { name: input.fullName },
    dedupeKey: `customer-welcome:${userId}`,
  });

  return { userId, verificationToken: token };
}

export async function approveStore(storeId: string, adminId: string) {
  const details = await withSystem(async (db) => {
    const existing = await db.maybeOne<{
      id: string;
      owner_id: string;
      name: string;
      slug: string;
      owner_email: string;
      owner_name: string;
      nin: string | null;
      proof_url: string | null;
    }>(
      `select s.id, s.owner_id, s.name, s.slug, u.email as owner_email, u.full_name as owner_name,
              vp.nin, vp.proof_of_residence_url as proof_url
         from stores s
         join users u on u.id = s.owner_id
         left join vendor_profiles vp on vp.user_id = s.owner_id
        where s.id = $1`,
      [storeId],
    );
    if (!existing) throw new Error("Storefront not found");
    if (!existing.proof_url || !existing.nin) {
      throw new Error(
        "Cannot approve storefront before registration documents (Proof of Residence & NIN) are uploaded and reviewed.",
      );
    }

    const store = await db.one<{ owner_id: string; name: string; slug: string; status: string }>(
      `update stores
          set status = 'active',
              approved_at = now(),
              approved_by = $2,
              rejection_reason = null,
              manual_suspension = false
        where id = $1
        returning owner_id, name, slug, status`,
      [storeId, adminId],
    );

    await db.execute(
      `insert into vendor_profiles (user_id, position, kyc_status, kyc_note, verified_at)
       values ($1, 'Owner', 'verified', 'Registration documents reviewed and approved.', now())
       on conflict (user_id) do update
         set kyc_status = 'verified',
             kyc_note = 'Registration documents reviewed and approved.',
             verified_at = now(),
             updated_at = now()`,
      [store.owner_id],
    );

    // Ensure vendor gets a full 14-day selling window starting from approval
    await db.execute(
      `update subscriptions
          set expires_at = greatest(expires_at, now() + interval '14 days')
        where store_id = $1 and status = 'trialing'`,
      [storeId],
    );

    const openMsg = await db.maybeOne<{ id: string }>(
      `update customer_messages
          set status = 'resolved', updated_at = now()
        where store_id = $1 and category = 'store_approval' and status in ('new','open','awaiting_customer')
        returning id`,
      [storeId],
    );

    await db.execute(
      `insert into customer_messages
         (store_id, customer_id, sender_name, sender_email, sender_role, category, subject, body, status, parent_id)
       values ($1,$2,'Ibom Vendors Hub Verification','support@ibomvendorshub.ng','admin','store_approval',$3,$4,'resolved',$5)`,
      [
        storeId,
        store.owner_id,
        `Storefront Approved & Open: ${store.name}`,
        `Congratulations ${existing.owner_name}! We reviewed your uploaded registration documents and approved ${store.name}. Your storefront is now LIVE and open to customers at ${url(`/s/${store.slug}`)}.`,
        openMsg?.id ?? null,
      ],
    );

    await logActivity(
      {
        actorId: adminId,
        actorRole: "admin",
        storeId,
        action: "store.approved",
        entityType: "store",
        entityId: storeId,
        description: `Reviewed documents and approved ${store.name}`,
      },
      db,
    );

    await notify(
      {
        userId: store.owner_id,
        storeId,
        type: "store_approved",
        title: "Your storefront has been approved & is now OPEN!",
        body: `${store.name} passed document verification and is now live and accepting customer orders.`,
        actionUrl: `/s/${store.slug}`,
        dedupeKey: `store-approved:${storeId}:${Date.now()}`,
      },
      db,
    );

    return existing;
  });

  try {
    await sendEmail({
      to: details.owner_email,
      template: "store_approved",
      data: {
        name: details.owner_name,
        storeName: details.name,
        storeUrl: url(`/s/${details.slug}`),
      },
      dedupeKey: `store-approved-email:${storeId}:${Date.now()}`,
    });
  } catch (err) {
    console.error("[approveStore] Non-fatal email error:", err);
  }
}

export async function rejectStore(storeId: string, adminId: string, reason: string) {
  const details = await withSystem(async (db) => {
    const existing = await db.maybeOne<{
      owner_id: string;
      name: string;
      slug: string;
      owner_email: string;
      owner_name: string;
    }>(
      `select s.owner_id, s.name, s.slug, u.email as owner_email, u.full_name as owner_name
         from stores s join users u on u.id = s.owner_id
        where s.id = $1`,
      [storeId],
    );
    if (!existing) throw new Error("Storefront not found");

    await db.execute(
      `update stores set status = 'rejected', rejection_reason = $2 where id = $1`,
      [storeId, reason],
    );

    await db.execute(
      `insert into vendor_profiles (user_id, position, kyc_status, kyc_note, verified_at)
       values ($1, 'Owner', 'rejected', $2, null)
       on conflict (user_id) do update
         set kyc_status = 'rejected',
             kyc_note = excluded.kyc_note,
             verified_at = null,
             updated_at = now()`,
      [existing.owner_id, reason],
    );

    const openMsg = await db.maybeOne<{ id: string }>(
      `update customer_messages
          set status = 'resolved', updated_at = now()
        where store_id = $1 and category = 'store_approval' and status in ('new','open','awaiting_customer')
        returning id`,
      [storeId],
    );

    await db.execute(
      `insert into customer_messages
         (store_id, customer_id, sender_name, sender_email, sender_role, category, subject, body, status, parent_id)
       values ($1,$2,'Ibom Vendors Hub Verification','support@ibomvendorshub.ng','admin','store_approval',$3,$4,'resolved',$5)`,
      [
        storeId,
        existing.owner_id,
        `Storefront Application Declined: ${existing.name}`,
        `Hi ${existing.owner_name}, after reviewing your registration documents for ${existing.name}, your storefront application was declined.\n\nReason: ${reason}\n\nYou can upload corrected verification documents in Store Profile (/vendor/store) for a fresh 48-hour review.`,
        openMsg?.id ?? null,
      ],
    );

    await logActivity(
      {
        actorId: adminId,
        actorRole: "admin",
        storeId,
        action: "store.rejected",
        entityType: "store",
        entityId: storeId,
        description: reason,
      },
      db,
    );

    await notify(
      {
        userId: existing.owner_id,
        storeId,
        type: "store_rejected",
        title: "Storefront application declined",
        body: `Your application for ${existing.name} was declined after document review. Reason: ${reason}`,
        actionUrl: "/vendor/store",
        dedupeKey: `store-rejected:${storeId}:${Date.now()}`,
      },
      db,
    );

    return existing;
  });

  try {
    await sendEmail({
      to: details.owner_email,
      template: "store_declined",
      data: {
        name: details.owner_name,
        storeName: details.name,
        reason,
      },
      dedupeKey: `store-declined-email:${storeId}:${Date.now()}`,
    });
  } catch (err) {
    console.error("[rejectStore] Non-fatal email error:", err);
  }
}

export async function resubmitStoreForReview(storeId: string) {
  await withSystem(async (db) => {
    const info = await db.maybeOne<{
      id: string;
      name: string;
      slug: string;
      status: string;
      owner_id: string;
      owner_name: string;
      owner_email: string;
      owner_phone: string | null;
      city: string | null;
      nin: string | null;
      proof_of_residence_type: string | null;
    }>(
      `select s.id, s.name, s.slug, s.status, s.owner_id, s.city,
              u.full_name as owner_name, u.email as owner_email, u.phone as owner_phone,
              vp.nin, vp.proof_of_residence_type
         from stores s
         join users u on u.id = s.owner_id
         left join vendor_profiles vp on vp.user_id = s.owner_id
        where s.id = $1`,
      [storeId],
    );
    if (!info || info.status !== "rejected") return;

    const updated = await db.one<{ review_deadline_at: string }>(
      `update stores
          set status = 'pending',
              rejection_reason = null,
              review_deadline_at = now() + interval '48 hours'
        where id = $1
        returning review_deadline_at`,
      [storeId],
    );

    await db.execute(
      `insert into customer_messages
         (store_id, customer_id, sender_name, sender_email, sender_role, category, subject, body, status)
       values ($1,$2,$3,$4,'vendor','store_approval',$5,$6,'open')`,
      [
        storeId,
        info.owner_id,
        info.owner_name,
        info.owner_email,
        `Re-Submitted Storefront Review (48h Timer): ${info.name}`,
        `Updated verification documents submitted for ${info.name} (${info.owner_name}, ${info.owner_email}).\nNIN: ${info.nin ?? "—"}\nProof of Residence: ${proofOfResidenceLabel(info.proof_of_residence_type)}\n48-Hour Deadline: ${new Date(updated.review_deadline_at).toUTCString()}`,
      ],
    );

    await notifyAdmins({
      storeId,
      type: "vendor_resubmitted",
      title: `48h Re-Review Required: ${info.name}`,
      body: `${info.owner_name} uploaded updated KYC documents for ${info.name}. Review within 48 hours.`,
      actionUrl: `/admin/vendors/${storeId}`,
      dedupeKey: `vendor-resubmit:${storeId}:${Date.now()}`,
    });
  });
}

export async function suspendStore(storeId: string, adminId: string, reason: string) {
  const store = await systemDb.one<{ owner_id: string; name: string; slug: string }>(
    `select owner_id, name, slug from stores where id = $1`,
    [storeId],
  );
  await withSystem(async (db) => {
    await db.execute(
      `update stores set manual_suspension = true, status = 'suspended', suspension_reason = $2,
              suspended_at = now(), suspended_by = $3 where id = $1`,
      [storeId, reason, adminId],
    );
    await logActivity(
      {
        actorId: adminId,
        actorRole: "admin",
        storeId,
        action: "store.suspended",
        entityType: "store",
        entityId: storeId,
        description: reason,
      },
      db,
    );
    await notify(
      {
        userId: store.owner_id,
        storeId,
        type: "store_suspended",
        title: "Storefront suspended",
        body: reason,
        actionUrl: "/vendor",
        dedupeKey: `store-suspended:${storeId}:${Date.now()}`,
      },
      db,
    );
  });
  await sendEmail({
    to: (await systemDb.one<{ email: string }>(`select email from users where id = $1`, [store.owner_id])).email,
    template: "store_suspended",
    data: { storeName: store.name, reason },
    dedupeKey: `store-suspended-email:${storeId}:${Date.now()}`,
  });
  await sendEmail({
    to: (await getSettings()).support_email,
    template: "admin_manual_suspension",
    data: { storeName: store.name, reason },
    dedupeKey: `admin-suspended:${storeId}:${Date.now()}`,
  });
}

export async function restoreStore(storeId: string, adminId: string) {
  await withSystem(async (db) => {
    await db.execute(
      `update stores set manual_suspension = false, suspension_reason = null,
              suspended_at = null, suspended_by = null,
              status = case when exists (
                select 1 from subscriptions s where s.store_id = stores.id
                 and s.status in ('active','trialing') and s.expires_at > now()
              ) then 'active' else 'expired' end
        where id = $1`,
      [storeId],
    );
    await logActivity(
      { actorId: adminId, actorRole: "admin", storeId, action: "store.restored", entityType: "store", entityId: storeId },
      db,
    );
  });
}

export async function getStoreOwnerEmail(storeId: string) {
  return systemDb.maybeOne<{ email: string; full_name: string; slug: string; name: string }>(
    `select u.email, u.full_name, s.slug, s.name
       from stores s join users u on u.id = s.owner_id where s.id = $1`,
    [storeId],
  );
}

export { isUniqueViolation };
