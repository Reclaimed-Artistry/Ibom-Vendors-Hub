import { isUniqueViolation, systemDb, withSystem } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { isReservedSubdomain, normaliseSubdomain } from "@/lib/domains";
import { getSettings } from "@/lib/settings";
import { logActivity } from "@/lib/audit";
import { notify, notifyAdmins } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { url } from "@/lib/settings";

export interface SubdomainCheck {
  available: boolean;
  slug: string;
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

  const existing = await systemDb.maybeOne<{ id: string }>(
    `select s.id from stores s
      where (s.slug = $1 or exists (select 1 from store_domains d where d.subdomain = $1))
        and ($2::uuid is null or s.id <> $2::uuid)
      union all
     select r.id from reserved_subdomains r where r.name = $1
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
      where requested_subdomain = $1 and status = 'pending' limit 1`,
    [slug],
  );
  if (pending) {
    return { available: false, slug, reason: "That store address is reserved by another request" };
  }

  return { available: true, slug };
}

/** Find a free variation (used only when the platform decides to auto-suffix). */
export async function suggestSubdomains(name: string) {
  const base = normaliseSubdomain(name);
  const candidates = [base];
  for (let i = 2; i <= 6; i += 1) candidates.push(`${base}-${i}`);
  const free: string[] = [];
  for (const candidate of candidates) {
    const check = await checkSubdomain(candidate);
    if (check.available) free.push(candidate);
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
  const settings = await getSettings();
  const email = input.email.trim().toLowerCase();
  const category = await systemDb.maybeOne<{ id: string; slug: string; name: string }>(
    `select id, slug, name from store_categories where slug = $1 and is_active = true`,
    [input.categorySlug],
  );
  if (!category) throw new Error("Choose a valid business category");

  const check = await checkSubdomain(input.businessName);
  if (!check.available) throw new Error(check.reason ?? "Store address unavailable");

  const existingUser = await systemDb.maybeOne<{ id: string }>(
    `select id from users where lower(email) = $1`,
    [email],
  );
  if (existingUser) {
    throw new Error("An account with this email already exists. Please sign in instead.");
  }

  const passwordHash = await hashPassword(input.password);
  const status = settings.require_vendor_approval ? "pending" : "active";

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
    const user = await db.one<{ id: string }>(
      `insert into users (email, password_hash, full_name, phone, role, email_verified_at)
       values ($1,$2,$3,$4,'vendor', null)
       returning id`,
      [email, passwordHash, input.ownerName.trim(), input.phone.trim()],
    );

    await db.execute(`insert into vendor_profiles (user_id, position) values ($1, 'Owner')`, [user.id]);
    await db.execute(
      `insert into user_roles (user_id, role) values ($1,'vendor') on conflict do nothing`,
      [user.id],
    );

    const store = await db.one<{ id: string; slug: string; status: string }>(
      `insert into stores
         (owner_id, category_id, name, slug, tagline, description, logo_url, cover_url,
          email, phone, city, state, address, country, status, approved_at,
          delivery_fee, prep_time_minutes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
               case when $15 = 'active' then now() else null end, 1500, 30)
       returning id, slug, status`,
      [
        user.id,
        category.id,
        input.businessName.trim(),
        check.slug,
        input.description.slice(0, 120),
        input.description.trim(),
        input.logoUrl || null,
        input.coverUrl || null,
        email,
        input.phone.trim(),
        input.city.trim(),
        input.state.trim(),
        input.address?.trim() || null,
        settings.country,
        status,
      ],
    );

    let trialEndsAt: string | null = null;
    let planName = "No plan";
    if (trialPlan) {
      const trialDays = trialPlan.trial_days > 0 ? trialPlan.trial_days : settings.default_trial_days;
      planName = trialPlan.name;
      if (trialDays > 0) {
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
    }

    await db.execute(
      `insert into vendor_balances (store_id) values ($1) on conflict (store_id) do nothing`,
      [store.id],
    );

    await logActivity(
      {
        actorId: user.id,
        actorRole: "vendor",
        storeId: store.id,
        action: "vendor.registered",
        entityType: "store",
        entityId: store.id,
        description: `${input.businessName} registered as ${category.name}`,
        meta: { category: category.slug, slug: check.slug },
      },
      db,
    );

    await notify(
      {
        userId: user.id,
        storeId: store.id,
        type: "welcome",
        title: "Welcome to Ibom Vendors Hub",
        body: `Your storefront address is ${check.slug}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000"}. Start adding products.`,
        actionUrl: "/vendor",
        dedupeKey: `welcome:${user.id}`,
      },
      db,
    );

    await notifyAdmins(
      {
        storeId: store.id,
        type: "vendor_registered",
        title: "New vendor registered",
        body: `${input.businessName} (${category.name}) just joined.`,
        actionUrl: `/admin/vendors/${store.id}`,
        dedupeKey: `vendor-registered:${store.id}`,
      },
      db,
    );

    return { userId: user.id, storeId: store.id, slug: store.slug, status: store.status, trialEndsAt, planName };
  });

  // Verification + welcome emails (outside the transaction).
  const { createAuthToken } = await import("@/lib/auth");
  const token = await createAuthToken(result.userId, "verify_email", 60 * 24);
  const verifyLink = url(`/verify-email?token=${token}`);

  await sendEmail({
    to: email,
    template: "verify_email",
    data: { name: input.ownerName, link: verifyLink },
    dedupeKey: `verify:${result.userId}:${token.slice(0, 12)}`,
  });
  await sendEmail({
    to: email,
    template: "vendor_welcome",
    data: {
      name: input.ownerName,
      storeName: input.businessName,
      storeUrl: url(`/s/${result.slug}`),
      planName: result.planName,
      expiresAt: result.trialEndsAt ? new Date(result.trialEndsAt).toDateString() : "—",
    },
    dedupeKey: `vendor-welcome:${result.userId}`,
  });
  await sendEmail({
    to: settings.support_email,
    template: "admin_new_vendor",
    data: { storeName: input.businessName, name: input.ownerName, email },
    dedupeKey: `admin-new-vendor:${result.storeId}`,
  });

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
  await withSystem(async (db) => {
    const store = await db.one<{ owner_id: string; name: string; slug: string; status: string }>(
      `update stores set status = 'active', approved_at = now(), approved_by = $2, rejection_reason = null
        where id = $1 returning owner_id, name, slug, status`,
      [storeId, adminId],
    );
    await logActivity(
      { actorId: adminId, actorRole: "admin", storeId, action: "store.approved", entityType: "store", entityId: storeId },
      db,
    );
    await notify(
      {
        userId: store.owner_id,
        storeId,
        type: "store_approved",
        title: "Your store has been approved",
        body: `${store.name} is now live and accepting customers.`,
        actionUrl: "/vendor",
        dedupeKey: `store-approved:${storeId}`,
      },
      db,
    );
    return store;
  });
  await sendEmail({
    to: (await systemDb.one<{ email: string }>(`select email from users u join stores s on s.owner_id = u.id where s.id = $1`, [storeId])).email,
    template: "store_reactivated",
    data: { storeUrl: url(`/s/${(await systemDb.one<{ slug: string }>(`select slug from stores where id = $1`, [storeId])).slug}`) },
    dedupeKey: `store-approved-email:${storeId}`,
  });
}

export async function rejectStore(storeId: string, adminId: string, reason: string) {
  await withSystem(async (db) => {
    await db.execute(
      `update stores set status = 'rejected', rejection_reason = $3 where id = $1`,
      [storeId, adminId, reason],
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
    await db.execute(
      `insert into activity_logs (actor_id, actor_role, store_id, action, entity_type, entity_id, description)
       values ($1,'admin',$2,'store.rejected','store',$2,$3)`,
      [adminId, storeId, reason],
    );
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
