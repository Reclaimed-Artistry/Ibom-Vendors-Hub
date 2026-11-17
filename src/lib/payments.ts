import { systemDb, withSystem, type Db } from "@/lib/db";
import { getSettings, paystackSecret } from "@/lib/settings";
import { verifyTransaction } from "@/lib/payments/gateway";
import { markOrdersPaid } from "@/lib/orders";
import { activateSubscriptionPayment } from "@/lib/subscriptions";
import { logActivity } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { notifyAdmins } from "@/lib/notifications";

export interface PaymentRow {
  id: string;
  reference: string;
  scope: "order" | "subscription" | "wallet";
  provider: "paystack" | "flutterwave" | "manual" | "sandbox";
  provider_reference: string | null;
  checkout_reference: string | null;
  store_id: string | null;
  order_id: string | null;
  subscription_id: string | null;
  plan_id: string | null;
  payer_user_id: string | null;
  payer_email: string;
  amount: number;
  currency: string;
  status: "pending" | "success" | "failed" | "abandoned" | "refunded";
  channel: string | null;
  authorization_url: string | null;
  paid_at: string | null;
  verified_at: string | null;
  failure_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function getPayment(reference: string) {
  return systemDb.maybeOne<PaymentRow>(`select * from payments where reference = $1`, [reference]);
}

/**
 * Single source of truth for marking money as received. Idempotent: replaying a
 * webhook or refreshing a callback can never double-credit an order or
 * double-extend a subscription.
 */
export async function markPaymentSuccessful(
  reference: string,
  opts: {
    channel?: string | null;
    providerReference?: string | null;
    raw?: Record<string, unknown>;
    via: "webhook" | "verify" | "sandbox" | "manual";
    verifiedBy?: string | null;
  },
) {
  return withSystem(async (db) => {
    const payment = await db.maybeOne<PaymentRow>(
      `select * from payments where reference = $1 for update`,
      [reference],
    );
    if (!payment) throw new Error("Payment not found");
    if (payment.status === "success") {
      return { payment, alreadyProcessed: true as const };
    }
    if (payment.status === "refunded") throw new Error("This payment has already been refunded");

    if (payment.scope === "order" && payment.checkout_reference) {
      await markOrdersPaid(db, payment.checkout_reference, payment.id, opts.channel ?? null);
    }
    if (payment.scope === "subscription") {
      await activateSubscriptionPayment(db, {
        id: payment.id,
        store_id: payment.store_id,
        plan_id: payment.plan_id,
        amount: Number(payment.amount),
        reference: payment.reference,
      });
    }
    if (payment.scope === "wallet") {
      await creditWallet(db, {
        userId: payment.payer_user_id,
        amount: Number(payment.amount),
        reference: payment.reference,
        provider: payment.provider,
        description: `Wallet topped up with ${payment.currency} ${Number(payment.amount).toLocaleString()}`,
      });
    }

    await db.execute(
      `update payments set status = 'success', paid_at = coalesce(paid_at, now()), verified_at = now(),
              channel = $2, provider_reference = coalesce($3, provider_reference), raw = $4::jsonb,
              failure_reason = null
        where id = $1`,
      [payment.id, opts.channel ?? payment.provider, opts.providerReference ?? null, JSON.stringify(opts.raw ?? {})],
    );

    await logActivity(
      {
        actorRole: "system",
        storeId: payment.store_id,
        action: "payment.verified",
        entityType: "payment",
        entityId: payment.id,
        description: `Payment ${payment.reference} verified via ${opts.via}`,
        meta: { amount: payment.amount, scope: payment.scope, via: opts.via, channel: opts.channel },
      },
      db,
    );

    const updated = await db.one<PaymentRow>(`select * from payments where id = $1`, [payment.id]);
    return { payment: updated, alreadyProcessed: false as const };
  });
}

export async function failPayment(reference: string, reason: string, raw?: Record<string, unknown>) {
  const payment = await getPayment(reference);
  if (!payment || payment.status === "success") return;
  await systemDb.execute(
    `update payments set status = 'failed', failure_reason = $2, raw = $3::jsonb where id = $1`,
    [payment.id, reason.slice(0, 400), JSON.stringify(raw ?? {})],
  );
  const settings = await getSettings();
  await sendEmail({
    to: settings.support_email,
    template: "admin_failed_payment",
    data: { email: payment.payer_email, orderReference: payment.reference, reason },
    dedupeKey: `payment-failed:${payment.id}`,
  });
}

/** Server-side verification against the gateway (never trust a redirect). */
export async function verifyPayment(reference: string) {
  const settings = await getSettings();
  const payment = await getPayment(reference);
  if (!payment) throw new Error("Payment reference not found");
  if (payment.status === "success") return { status: "success" as const, payment };

  if (payment.provider === "paystack") {
    const secret = paystackSecret(settings);
    if (!secret) throw new Error("Paystack is not configured");
    const result = await verifyTransaction({
      reference: payment.reference,
      expectedAmount: Number(payment.amount),
      expectedCurrency: payment.currency,
      secretKey: secret,
    });
    if (!result.success) {
      await failPayment(reference, result.failureReason ?? "Payment verification failed", result.raw);
      return { status: "failed" as const, payment, reason: result.failureReason };
    }
    const marked = await markPaymentSuccessful(reference, {
      channel: result.channel,
      providerReference: result.providerReference,
      raw: result.raw,
      via: "verify",
    });
    return { status: "success" as const, payment: marked.payment };
  }

  // Sandbox gateway: a persisted pending payment can be confirmed explicitly
  // from the sandbox checkout screen. Nothing is trusted from the browser —
  // the record, amount and status all come from the database.
  if (payment.provider === "sandbox") {
    return { status: "pending" as const, payment };
  }

  throw new Error("Unsupported payment provider");
}

export async function confirmSandboxPayment(reference: string, opts?: { channel?: string }) {
  const settings = await getSettings();
  if (!settings.sandbox_payments) throw new Error("Sandbox payments are disabled");
  const payment = await getPayment(reference);
  if (!payment) throw new Error("Payment reference not found");
  if (payment.provider !== "sandbox") throw new Error("This payment is not a sandbox payment");
  if (payment.status === "success") return { status: "success" as const, payment };

  const marked = await markPaymentSuccessful(reference, {
    channel: opts?.channel ?? "sandbox",
    raw: { simulated: true, confirmedAt: new Date().toISOString() },
    via: "sandbox",
  });
  return { status: "success" as const, payment: marked.payment };
}

export async function getPaymentContext(reference: string) {
  const payment = await getPayment(reference);
  if (!payment) return null;
  const orders = payment.checkout_reference
    ? await systemDb.query<{ id: string; reference: string; total: number; store_name: string }>(
        `select o.id, o.reference, o.total, s.name as store_name
           from orders o join stores s on s.id = o.store_id
          where o.checkout_reference = $1`,
        [payment.checkout_reference],
      )
    : [];
  const plan = payment.plan_id
    ? await systemDb.maybeOne<{ name: string; duration_days: number }>(
        `select name, duration_days from subscription_plans where id = $1`,
        [payment.plan_id],
      )
    : null;
  const store = payment.store_id
    ? await systemDb.maybeOne<{ name: string; slug: string }>(
        `select name, slug from stores where id = $1`,
        [payment.store_id],
      )
    : null;
  return { payment, orders, plan, store };
}

/* -------------------------------------------------------------------------- */
/* Refunds                                                                    */
/* -------------------------------------------------------------------------- */

export async function listRefunds(status?: string) {
  return systemDb.query<{
    id: string;
    amount: number;
    reason: string | null;
    status: string;
    created_at: string;
    order_reference: string | null;
    store_name: string | null;
    payment_reference: string | null;
  }>(
    `select r.*, o.reference as order_reference, s.name as store_name, p.reference as payment_reference
       from refunds r
       left join orders o on o.id = r.order_id
       left join stores s on s.id = r.store_id
       left join payments p on p.id = r.payment_id
      where ($1::text is null or r.status = $1)
      order by r.created_at desc limit 100`,
    [status ?? null],
  );
}

export async function processRefund(refundId: string, adminId: string, approve: boolean, note?: string) {
  const refund = await systemDb.maybeOne<{
    id: string;
    payment_id: string | null;
    order_id: string | null;
    store_id: string | null;
    amount: number;
    status: string;
    reason: string | null;
  }>(`select * from refunds where id = $1`, [refundId]);
  if (!refund) throw new Error("Refund not found");
  if (refund.status === "processed") return { ok: true };

  const settings = await getSettings();
  const payment = refund.payment_id
    ? await systemDb.maybeOne<PaymentRow>(`select * from payments where id = $1`, [refund.payment_id])
    : null;

  if (!approve) {
    await systemDb.execute(
      `update refunds set status='rejected', processed_by=$2, processed_at=now() where id=$1`,
      [refundId, adminId],
    );
    await logActivity({
      actorId: adminId,
      actorRole: "admin",
      storeId: refund.store_id,
      action: "refund.rejected",
      entityType: "refund",
      entityId: refundId,
      description: note ?? "Refund rejected",
    });
    return { ok: true };
  }

  let gatewayReference: string | null = null;
  if (payment && payment.provider === "paystack" && paystackSecret(settings)) {
    const response = await fetch("https://api.paystack.co/refund", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret(settings)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transaction: payment.reference, amount: Math.round(Number(refund.amount) * 100) }),
      signal: AbortSignal.timeout(20_000),
    });
    const json = (await response.json().catch(() => ({}))) as { status?: boolean; data?: { id?: string }; message?: string };
    if (!response.ok || !json.status) {
      throw new Error(json.message ?? "Gateway refund failed");
    }
    gatewayReference = json.data?.id ? String(json.data.id) : null;
  }

  await withSystem(async (db) => {
    await db.execute(
      `update refunds set status='processed', processed_by=$2, processed_at=now(), gateway_reference=$3 where id=$1`,
      [refundId, adminId, gatewayReference],
    );
    if (payment) {
      await db.execute(`update payments set status = 'refunded' where id = $1`, [payment.id]);
    }
    if (refund.order_id) {
      await db.execute(
        `update orders set payment_status='refunded', status = case when status in ('cancelled','rejected') then status else 'cancelled' end,
                cancellation_reason = coalesce(cancellation_reason, 'Refunded by administrator')
          where id = $1`,
        [refund.order_id],
      );
    }
    if (refund.store_id) {
      await db.execute(
        `update vendor_balances set lifetime_refunds = lifetime_refunds + $2,
                available_amount = greatest(available_amount - $2, 0),
                pending_amount = greatest(pending_amount - $2, 0), updated_at = now()
          where store_id = $1`,
        [refund.store_id, refund.amount],
      );
    }
    await logActivity(
      {
        actorId: adminId,
        actorRole: "admin",
        storeId: refund.store_id,
        action: "refund.processed",
        entityType: "refund",
        entityId: refundId,
        description: `Refund of ${refund.amount} processed`,
        meta: { gatewayReference, note },
      },
      db,
    );
  });

  if (payment) {
    await sendEmail({
      to: payment.payer_email,
      template: "refund_updated",
      data: { status: "processed", amount: refund.amount, currency: settings.currency, orderReference: payment.reference },
      dedupeKey: `refund-processed:${refundId}`,
    });
  }
  await notifyAdmins({
    type: "refund_processed",
    title: "Refund processed",
    body: `A refund of ₦${Number(refund.amount).toLocaleString()} was processed.`,
    actionUrl: "/admin/payments",
    dedupeKey: `refund-processed-admin:${refundId}`,
  });

  return { ok: true, gatewayReference };
}

export async function getPaymentStats() {
  return systemDb.one<{
    total_volume: number;
    success_count: number;
    pending_count: number;
    failed_count: number;
    subscription_revenue: number;
    order_revenue: number;
  }>(
    `select
       coalesce(sum(case when status='success' then amount else 0 end),0) as total_volume,
       count(*) filter (where status='success')::int as success_count,
       count(*) filter (where status='pending')::int as pending_count,
       count(*) filter (where status='failed')::int as failed_count,
       coalesce(sum(case when status='success' and scope='subscription' then amount else 0 end),0) as subscription_revenue,
       coalesce(sum(case when status='success' and scope='order' then amount else 0 end),0) as order_revenue
     from payments`,
  );
}

/** Credit a customer's wallet after a successful top-up payment. Idempotent
 *  via the wallet_transactions reference (unique). */
async function creditWallet(db: Db, input: {
  userId: string | null;
  amount: number;
  reference: string;
  provider: string;
  description: string;
}) {
  if (!input.userId || input.amount <= 0) return;
  const wallet = await db.one<{ id: string; balance: number }>(
    `insert into wallets (user_id, balance, currency)
     values ($1, $2, 'NGN')
     on conflict (user_id) do update
       set balance = wallets.balance + excluded.balance, updated_at = now()
     returning id, balance`,
    [input.userId, input.amount],
  );
  await db.execute(
    `insert into wallet_transactions (wallet_id, type, amount, reference, description, status)
     values ($1,'credit',$2,$3,$4,'success')`,
    [wallet.id, input.amount, input.reference, input.description],
  );
  await logActivity(
    {
      actorRole: "system",
      storeId: null,
      action: "wallet.credited",
      entityType: "wallet",
      entityId: wallet.id,
      description: input.description,
      meta: { amount: input.amount, provider: input.provider, reference: input.reference },
    },
    db,
  );
}
