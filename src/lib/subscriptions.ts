import { systemDb, withSystem, type Db } from "@/lib/db";
import { getSettings, paystackSecret, url } from "@/lib/settings";
import { initializeTransaction } from "@/lib/payments/gateway";
import { sendEmail } from "@/lib/email";
import { notify, notifyAdmins } from "@/lib/notifications";
import { logActivity } from "@/lib/audit";
import { countdownLabel } from "@/lib/utils";
import type { Store } from "@/lib/types";

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  currency: string;
  interval_months: number;
  duration_days: number;
  trial_days: number;
  product_limit: number | null;
  order_limit: number | null;
  features: string[];
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
}

export interface StoreSubscription {
  id: string;
  store_id: string;
  plan_id: string;
  status: "trialing" | "active" | "expired" | "cancelled" | "pending";
  started_at: string;
  expires_at: string;
  auto_renew: boolean;
  reminder_stage: number;
  plan: Plan;
}

export async function getPlans(includeInactive = false) {
  const rows = await systemDb.query<Plan>(
    `select * from subscription_plans ${includeInactive ? "" : "where is_active = true"}
      order by sort_order, price`,
  );
  return rows.map((row) => ({ ...row, price: Number(row.price), features: row.features ?? [] }));
}

export async function getStoreSubscription(storeId: string): Promise<StoreSubscription | null> {
  const row = await systemDb.maybeOne<StoreSubscription & { plan: Plan }>(
    `select s.*,
            to_jsonb(p.*) as plan
       from subscriptions s
       join subscription_plans p on p.id = s.plan_id
      where s.store_id = $1 and s.status in ('trialing','active')
      order by s.expires_at desc limit 1`,
    [storeId],
  );
  if (!row) return null;
  return { ...row, plan: { ...row.plan, price: Number(row.plan.price), features: row.plan.features ?? [] } };
}

export function subscriptionState(subscription: StoreSubscription | null) {
  if (!subscription) {
    return { active: false, trialing: false, label: "No subscription", tone: "danger" as const, days: 0, expiresAt: null };
  }
  const countdown = countdownLabel(subscription.expires_at);
  const expired = new Date(subscription.expires_at).getTime() <= Date.now();
  return {
    active: !expired,
    trialing: subscription.status === "trialing",
    label: expired ? "Expired" : countdown.label,
    tone: expired ? ("danger" as const) : countdown.tone,
    days: countdown.days,
    expiresAt: subscription.expires_at,
  };
}

/* -------------------------------------------------------------------------- */
/* Purchase / renewal                                                         */
/* -------------------------------------------------------------------------- */

export interface PurchaseResult {
  activated: boolean;
  paymentReference?: string;
  authorizationUrl?: string;
  amount: number;
  expiry?: string;
}

export async function purchaseSubscription(input: {
  store: Store;
  plan: Plan;
  payerEmail: string;
  payerUserId: string | null;
}): Promise<PurchaseResult> {
  const settings = await getSettings();
  const current = await getStoreSubscription(input.store.id);

  if (Number(input.plan.price) <= 0) {
    const applied = await withSystem(async (db) =>
      db.one<{ new_expires_at: string }>(
        `select * from apply_subscription_payment($1,$2,null,0,'admin_grant',null,$3)`,
        [input.store.id, input.plan.id, "Free plan activation"],
      ),
    );
    await sendEmail({
      to: input.payerEmail,
      template: "subscription_activated",
      data: { planName: input.plan.name, amount: 0, currency: settings.currency, expiresAt: applied.new_expires_at },
      dedupeKey: `sub-activated:${input.store.id}:${applied.new_expires_at}`,
    });
    return { activated: true, amount: 0, expiry: applied.new_expires_at };
  }

  const reference = (
    await systemDb.one<{ ref: string }>(`select next_payment_reference('SUB') as ref`)
  ).ref;
  const provider = paystackSecret(settings) ? "paystack" : "sandbox";

  const payment = await systemDb.one<{ id: string }>(
    `insert into payments
       (reference, scope, provider, store_id, subscription_id, plan_id, payer_user_id, payer_email,
        amount, currency, status, metadata)
     values ($1,'subscription',$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10::jsonb)
     returning id`,
    [
      reference,
      provider,
      input.store.id,
      current?.id ?? null,
      input.plan.id,
      input.payerUserId,
      input.payerEmail,
      input.plan.price,
      settings.currency,
      JSON.stringify({ planSlug: input.plan.slug, storeSlug: input.store.slug, purpose: "subscription" }),
    ],
  );

  const init = await initializeTransaction({
    reference,
    amount: Number(input.plan.price),
    email: input.payerEmail,
    currency: settings.currency,
    callbackUrl: url(`/pay/callback?reference=${reference}`),
    metadata: { storeId: input.store.id, planId: input.plan.id, purpose: "subscription" },
    secretKey: paystackSecret(settings),
  });

  await systemDb.execute(`update payments set authorization_url = $2 where id = $1`, [payment.id, init.authorizationUrl]);

  return {
    activated: false,
    paymentReference: reference,
    authorizationUrl: init.authorizationUrl,
    amount: Number(input.plan.price),
  };
}

/** Called by the payment orchestrator once a subscription payment is verified. */
export async function activateSubscriptionPayment(
  db: Db,
  payment: { id: string; store_id: string | null; plan_id: string | null; amount: number; reference: string },
) {
  if (!payment.store_id || !payment.plan_id) throw new Error("Subscription payment is missing store or plan");

  const plan = await db.one<Plan>(`select * from subscription_plans where id = $1`, [payment.plan_id]);
  const applied = await db.one<{ id: string; old_expires_at: string | null; new_expires_at: string; days_added: number }>(
    `select * from apply_subscription_payment($1,$2,$3,$4,'gateway',null,$5)`,
    [payment.store_id, payment.plan_id, payment.id, payment.amount, `Payment ${payment.reference}`],
  );

  await db.execute(
    `update subscription_payments set status = 'success', payment_id = $2 where id = $1`,
    [applied.id, payment.id],
  );

  const owner = await db.one<{ email: string; full_name: string; slug: string; name: string }>(
    `select u.email, u.full_name, s.slug, s.name
       from stores s join users u on u.id = s.owner_id where s.id = $1`,
    [payment.store_id],
  );

  const settings = await getSettings();
  const wasRenewal = Boolean(applied.old_expires_at);

  await sendEmail({
    to: owner.email,
    template: wasRenewal ? "subscription_renewed" : "subscription_activated",
    data: {
      name: owner.full_name,
      storeName: owner.name,
      planName: plan.name,
      amount: payment.amount,
      currency: settings.currency,
      expiresAt: applied.new_expires_at,
    },
    dedupeKey: `sub-payment:${payment.id}`,
  });
  await sendEmail({
    to: settings.support_email,
    template: "admin_subscription_payment",
    data: { storeName: owner.name, amount: payment.amount, currency: settings.currency, planName: plan.name },
    dedupeKey: `admin-sub-payment:${payment.id}`,
  });

  return applied;
}

/** Administrator grant/extend without a gateway payment (manual verification). */
export async function adminGrantSubscription(input: {
  storeId: string;
  planId: string;
  adminId: string;
  note?: string;
}) {
  const result = await withSystem(async (db) => {
    const plan = await db.one<Plan>(`select * from subscription_plans where id = $1`, [input.planId]);
    const applied = await db.one<{ id: string; new_expires_at: string }>(
      `select * from apply_subscription_payment($1,$2,null,$3,'admin_grant',$4,$5)`,
      [input.storeId, input.planId, 0, input.adminId, input.note ?? `Granted by administrator (${plan.name})`],
    );
    await db.execute(
      `update subscription_payments set status = 'success', verification_method = 'admin_grant', verified_by = $2
        where id = $1`,
      [applied.id, input.adminId],
    );
    await logActivity(
      {
        actorId: input.adminId,
        actorRole: "admin",
        storeId: input.storeId,
        action: "subscription.granted",
        entityType: "subscription_payment",
        entityId: applied.id,
        description: `Administrator granted ${plan.name}`,
        meta: { expiresAt: applied.new_expires_at },
      },
      db,
    );
    return { applied, plan };
  });

  const owner = await systemDb.maybeOne<{ email: string; full_name: string; name: string }>(
    `select u.email, u.full_name, s.name from stores s join users u on u.id = s.owner_id where s.id = $1`,
    [input.storeId],
  );
  if (owner) {
    const settings = await getSettings();
    await sendEmail({
      to: owner.email,
      template: "subscription_activated",
      data: {
        name: owner.full_name,
        storeName: owner.name,
        planName: result.plan.name,
        amount: 0,
        currency: settings.currency,
        expiresAt: result.applied.new_expires_at,
      },
      dedupeKey: `sub-grant:${result.applied.id}`,
    });
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/* Scheduled maintenance                                                      */
/* -------------------------------------------------------------------------- */

export async function runSubscriptionMaintenance() {
  const settings = await getSettings();
  const startedAt = new Date();
  const job = await systemDb.one<{ id: string }>(
    `insert into scheduled_job_runs (job_name, status) values ('subscription-maintenance','running') returning id`,
  );

  const summary = { expired: 0, reminders: 0, emailsRetried: 0, errors: [] as string[] };

  try {
    // 1) Expiry enforcement (idempotent SQL function)
    const expired = await systemDb.query<{
      store_id: string;
      subscription_id: string | null;
      store_name: string;
      owner_id: string;
      expires_at: string;
    }>(`select * from process_subscription_expiry()`);

    for (const row of expired) {
      summary.expired += 1;
      const owner = await systemDb.maybeOne<{ email: string; full_name: string }>(
        `select email, full_name from users where id = $1`,
        [row.owner_id],
      );
      if (owner) {
        await sendEmail({
          to: owner.email,
          template: "subscription_expired",
          data: {
            name: owner.full_name,
            storeName: row.store_name,
            expiresAt: new Date(row.expires_at).toDateString(),
          },
          dedupeKey: `sub-expired-email:${row.subscription_id ?? row.store_id}:${row.expires_at}`,
        });
      }
      await notifyAdmins({
        storeId: row.store_id,
        type: "store_expired",
        title: "Store suspended (expired)",
        body: `${row.store_name} expired and its storefront is now offline.`,
        actionUrl: `/admin/vendors/${row.store_id}`,
        dedupeKey: `admin-store-expired:${row.subscription_id ?? row.store_id}:${row.expires_at}`,
      });
    }

    // 2) Expiry reminders (7 / 3 / 1 days by default, configurable)
    const thresholds = [...(settings.expiry_reminder_days ?? [7, 3, 1])].sort((a, b) => b - a);
    const upcoming = await systemDb.query<{
      id: string;
      store_id: string;
      expires_at: string;
      reminder_stage: number;
      plan_name: string;
      store_name: string;
      email: string;
      full_name: string;
    }>(
      `select s.id, s.store_id, s.expires_at, s.reminder_stage, p.name as plan_name,
              st.name as store_name, u.email, u.full_name
         from subscriptions s
         join subscription_plans p on p.id = s.plan_id
         join stores st on st.id = s.store_id
         join users u on u.id = st.owner_id
        where s.status in ('active','trialing') and s.expires_at > now()
          and s.expires_at <= now() + make_interval(days => $1)`,
      [Math.max(...thresholds, 1)],
    );

    for (const sub of upcoming) {
      const days = Math.ceil((new Date(sub.expires_at).getTime() - Date.now()) / 86_400_000);
      const stage = thresholds.reduce((acc, threshold, index) => (days <= threshold ? index + 1 : acc), 0);
      if (stage <= 0 || stage <= sub.reminder_stage) continue;

      summary.reminders += 1;
      await systemDb.execute(`update subscriptions set reminder_stage = $2 where id = $1`, [sub.id, stage]);
      await sendEmail({
        to: sub.email,
        template: "subscription_expiring",
        data: {
          name: sub.full_name,
          storeName: sub.store_name,
          planName: sub.plan_name,
          daysRemaining: days,
          expiresAt: new Date(sub.expires_at).toDateString(),
        },
        dedupeKey: `sub-reminder:${sub.id}:${stage}`,
      });
      await notify({
        userId: null,
        storeId: sub.store_id,
        type: "subscription_expiring",
        title: `Subscription expires in ${days} day${days === 1 ? "" : "s"}`,
        body: `Renew your ${sub.plan_name} plan to keep your storefront online.`,
        actionUrl: "/vendor/subscription",
        dedupeKey: `sub-reminder-inapp:${sub.id}:${stage}`,
      });
    }

    const { retryFailedEmails } = await import("@/lib/email");
    const retried = await retryFailedEmails(10);
    summary.emailsRetried = retried.sent;

    await systemDb.execute(
      `update scheduled_job_runs set status='success', finished_at=now(), details=$2::jsonb where id=$1`,
      [job.id, JSON.stringify({ ...summary, startedAt, durationMs: Date.now() - startedAt.getTime() })],
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    summary.errors.push(message);
    await systemDb.execute(
      `update scheduled_job_runs set status='failed', finished_at=now(), details=$2::jsonb where id=$1`,
      [job.id, JSON.stringify({ ...summary, error: message })],
    );
  }

  return summary;
}

/* -------------------------------------------------------------------------- */
/* Reporting helpers                                                          */
/* -------------------------------------------------------------------------- */

export async function getSubscriptionOverview(storeId: string) {
  const history = await systemDb.query<{
    id: string;
    from_status: string | null;
    to_status: string;
    from_expires_at: string | null;
    to_expires_at: string | null;
    note: string | null;
    created_at: string;
  }>(
    `select * from subscription_history where store_id = $1 order by created_at desc limit 20`,
    [storeId],
  );
  const payments = await systemDb.query<{
    id: string;
    amount: number;
    currency: string;
    days_added: number;
    status: string;
    verification_method: string | null;
    created_at: string;
    old_expires_at: string | null;
    new_expires_at: string | null;
    plan_name: string | null;
  }>(
    `select sp.*, p.name as plan_name
       from subscription_payments sp
       left join subscription_plans p on p.id = sp.plan_id
      where sp.store_id = $1 order by sp.created_at desc limit 20`,
    [storeId],
  );
  return { history, payments };
}
