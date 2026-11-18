import { calculateDeliveryFee } from "@/lib/delivery-fees";
import { systemDb, withSystem, type Db } from "@/lib/db";
import { getSettings, paystackSecret, url } from "@/lib/settings";
import { initializeTransaction } from "@/lib/payments/gateway";
import { sendEmail } from "@/lib/email";
import { notify, notifyAdmins } from "@/lib/notifications";
import { logActivity } from "@/lib/audit";
import { getVendorContext, vendorSuspensionMessage } from "@/lib/auth";
import type { CheckoutInput } from "@/lib/validation";
import type { Order, OrderItem, Store, StoreCategory } from "@/lib/types";
import { workflowFor, workflowLabel } from "@/lib/storefront";

/* -------------------------------------------------------------------------- */
/* Checkout                                                                   */
/* -------------------------------------------------------------------------- */

interface ProductRow {
  product_delivery_fee: number | null;
  id: string;
  store_id: string;
  name: string;
  slug: string;
  kind: "product" | "service";
  price: number;
  track_stock: boolean;
  stock_quantity: number;
  is_available: boolean;
  made_to_order: boolean;
  production_days: number | null;
  prep_time_minutes: number | null;
  service_duration_minutes: number | null;
  store_name: string;
  store_slug: string;
  store_status: string;
  manual_suspension: boolean;
  visibility: string;
  accepts_orders: boolean;
  accepts_delivery: boolean;
  accepts_pickup: boolean;
  delivery_fee: number;
  minimum_order: number;
  subscription_active: boolean;
  access_until: string | null;
  owner_id: string;
  store_email: string | null;
  store_address: string | null;
  store_city: string | null;
  store_state: string | null;
  store_phone: string | null;
  category_id: string | null;
}

export interface CheckoutResult {
  checkoutReference: string;
  paymentReference: string;
  authorizationUrl: string;
  total: number;
  currency: string;
  orders: Array<{ id: string; reference: string; storeName: string; storeSlug: string; total: number }>;
}

function addonsTotal(raw: unknown): number {
  if (!Array.isArray(raw)) return 0;
  return raw.reduce((sum, item) => sum + Number((item as { price?: number })?.price ?? 0), 0);
}

export async function createCheckout(
  input: CheckoutInput,
  customer: { id: string; email: string; fullName: string } | null,
  paymentMethod: "gateway" | "bank_transfer" = "gateway",
): Promise<CheckoutResult> {
  if (!customer?.id) {
    throw new Error("Please sign in to your account before checking out.");
  }
  const settings = await getSettings();
  if (!settings.payments_enabled) throw new Error("Payments are temporarily disabled by the platform.");

  const productIds = [...new Set(input.items.map((item) => item.productId))];

  const prepared = await withSystem(async (db) => {
    const rows = await db.query<ProductRow>(
      `select p.delivery_fee as product_delivery_fee, p.id, p.store_id, p.name, p.slug, p.kind, p.price, p.track_stock, p.stock_quantity,
              p.is_available, p.made_to_order, p.production_days, p.prep_time_minutes,
              p.service_duration_minutes,
              s.name as store_name, s.slug as store_slug, s.status as store_status,
              s.manual_suspension, s.visibility, s.accepts_orders, s.accepts_delivery,
              s.accepts_pickup, s.delivery_fee, s.minimum_order, s.access_until, s.owner_id,
              s.email as store_email, s.address as store_address, s.city as store_city,
              s.state as store_state, s.phone as store_phone, s.category_id,
              exists (select 1 from subscriptions su where su.store_id = s.id
                and su.status in ('active','trialing') and su.expires_at > now()) as subscription_active
         from products p join stores s on s.id = p.store_id
        where p.id = any($1::uuid[])`,
      [productIds],
    );
    if (rows.length !== productIds.length) {
      throw new Error("One of the items in your cart is no longer available.");
    }
    const byId = new Map(rows.map((row) => [row.id, row]));
    const banks = paymentMethod === "bank_transfer" ? await db.query<{ store_id: string; bank_name: string; account_name: string; account_number: string }>(
      `select s.id as store_id, v.bank_name, v.account_name, v.account_number from stores s join vendor_profiles v on v.user_id = s.owner_id where s.id = any($1::uuid[])`,
      [[...new Set(rows.map((row) => row.store_id))]],
    ) : [];
    if (paymentMethod === "bank_transfer") {
      for (const row of rows) {
        const bank = banks.find((entry) => entry.store_id === row.store_id);
        if (!bank?.bank_name?.trim() || !bank.account_name?.trim() || !/^\d{10}$/.test(bank.account_number)) {
          throw new Error(`${row.store_name} has not configured valid bank details yet. Please contact the vendor before paying.`);
        }
      }
    }


    const variants = await db.query<{
      id: string;
      product_id: string;
      name: string;
      price: number | null;
      is_available: boolean;
      stock_quantity: number;
      attributes: Record<string, string>;
    }>(`select id, product_id, name, price, is_available, stock_quantity, attributes
          from product_variants where product_id = any($1::uuid[])`, [productIds]);
    const variantById = new Map(variants.map((variant) => [variant.id, variant]));

    const addons = await db.query<{ product_id: string; name: string; price: number }>(
      `select product_id, name, price from product_addons
        where product_id = any($1::uuid[]) and is_available`,
      [productIds],
    );

    const groups = new Map<
      string,
      {
        store: ProductRow;
        items: Array<{
          productId: string;
          variantId: string | null;
          name: string;
          variantName: string | null;
          kind: "product" | "service";
          unitPrice: number;
          quantity: number;
          lineTotal: number;
          addons: Array<{ name: string; price: number }>;
          notes: string | null;
          measurements: Record<string, string>;
          referenceImages: string[];
          durationMinutes: number | null;
        }>;
        subtotal: number;
      }
    >();

    for (const line of input.items) {
      const product = byId.get(line.productId);
      if (!product) throw new Error("An item in your cart is unavailable.");

      const live =
        product.store_status === "active" &&
        !product.manual_suspension &&
        product.visibility === "public" &&
        (product.subscription_active ||
          (product.access_until ? new Date(product.access_until) > new Date() : false));
      if (!live) {
        throw new Error(`${product.store_name} is not accepting orders right now.`);
      }
      if (!product.accepts_orders) {
        throw new Error(`${product.store_name} has paused incoming orders. Please try again later.`);
      }
      if (!product.is_available) {
        throw new Error(`${product.name} is currently unavailable.`);
      }

      let unitPrice = Number(product.price);
      let variantName: string | null = null;
      let variantAttributes: Record<string, string> = {};
      let variant: (typeof variants)[number] | undefined;

      if (line.variantId) {
        variant = variantById.get(line.variantId);
        if (!variant || variant.product_id !== product.id) {
          throw new Error(`The selected option for ${product.name} is no longer available.`);
        }
        if (!variant.is_available) throw new Error(`${product.name} — ${variant.name} is out of stock.`);
        unitPrice = variant.price != null ? Number(variant.price) : unitPrice;
        variantName = variant.name;
        variantAttributes = variant.attributes ?? {};
      }

      if (product.track_stock) {
        const available = variant ? variant.stock_quantity : product.stock_quantity;
        if (Number(available) < line.quantity) {
          throw new Error(`Only ${Math.max(Number(available), 0)} left of ${product.name}.`);
        }
      }

      const chosenAddons = (line.addons ?? [])
        .map((name) => addons.find((a) => a.product_id === product.id && a.name === name))
        .filter((a): a is { product_id: string; name: string; price: number } => Boolean(a))
        .map((a) => ({ name: a.name, price: Number(a.price) }));

      const unitWithAddons = unitPrice + addonsTotal(chosenAddons);
      const lineTotal = Number((unitWithAddons * line.quantity).toFixed(2));

      const group = groups.get(product.store_id) ?? { store: product, items: [], subtotal: 0 };
      group.items.push({
        productId: product.id,
        variantId: line.variantId ?? null,
        name: product.name,
        variantName,
        kind: product.kind,
        unitPrice: Number(unitWithAddons.toFixed(2)),
        quantity: line.quantity,
        lineTotal,
        addons: chosenAddons,
        notes: line.notes || null,
        measurements: { ...(variantAttributes ?? {}), ...(line.measurements ?? {}) },
        referenceImages: line.quantity && input.referenceImages?.length ? input.referenceImages : [],
        durationMinutes: product.service_duration_minutes ?? null,
      });
      group.subtotal = Number((group.subtotal + lineTotal).toFixed(2));
      groups.set(product.store_id, group);
    }

    if (!groups.size) throw new Error("Your cart is empty.");

    const checkoutReference = (
      await db.one<{ ref: string }>(`select next_checkout_reference() as ref`)
    ).ref;

    const created: CheckoutResult["orders"] = [];
    let grandTotal = 0;

    for (const [, group] of groups) {
      const store = group.store;
      const isServiceOnly = group.items.every((item) => item.kind === "service");
      const fulfilment = isServiceOnly
        ? "service"
        : input.fulfilmentType === "pickup"
          ? "pickup"
          : "delivery";

      if (fulfilment === "delivery" && !store.accepts_delivery) {
        throw new Error(`${store.store_name} does not offer delivery. Choose pickup instead.`);
      }
      if (fulfilment === "pickup" && !store.accepts_pickup) {
        throw new Error(`${store.store_name} does not offer pickup.`);
      }
      if (fulfilment === "delivery" && !input.address) {
        throw new Error("A delivery address is required.");
      }
      if (Number(store.minimum_order) > 0 && group.subtotal < Number(store.minimum_order)) {
        throw new Error(
          `${store.store_name} has a minimum order of ₦${Number(store.minimum_order).toLocaleString()}.`,
        );
      }

      const deliveryFee = fulfilment === "delivery" ? calculateDeliveryFee(group.items.map((item) => ({ kind: item.kind, quantity: item.quantity, deliveryFee: byId.get(item.productId)?.product_delivery_fee })), Number(store.delivery_fee)) : 0;
      const total = Number((group.subtotal + deliveryFee).toFixed(2));
      const commission = Number((group.subtotal * (Number(settings.commission_rate) / 100)).toFixed(2));
      const payable = Number((total - commission).toFixed(2));

      const vendorPickupAddress = [
        store.store_name,
        store.store_address,
        store.store_city,
        store.store_state ?? "Akwa Ibom",
      ]
        .filter(Boolean)
        .join(", ");
      const resolvedPickupLocation =
        fulfilment === "pickup" ? input.pickupLocation?.trim() || vendorPickupAddress : null;

      const order = await db.one<{ id: string; reference: string }>(
        `insert into orders
           (checkout_reference, store_id, customer_id, customer_name, customer_email, customer_phone,
            status, payment_status, fulfilment_type, currency, subtotal, delivery_fee, total,
            platform_commission, vendor_payable, delivery_address, pickup_location, delivery_notes,
            customer_notes, scheduled_for)
         values ($1,$2,$3,$4,$5,$6,'placed','pending',$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18)
         returning id, reference`,
        [
          checkoutReference,
          store.store_id,
          customer.id,
          input.customerName.trim(),
          input.customerEmail.trim().toLowerCase(),
          input.customerPhone.trim(),
          fulfilment,
          settings.currency,
          group.subtotal,
          deliveryFee,
          total,
          commission,
          payable,
          JSON.stringify(
            fulfilment === "delivery"
              ? {
                  address: input.address ?? "",
                  city: input.city ?? "",
                  state: input.state ?? "Akwa Ibom",
                  bio_address: input.bioAddress ?? "",
                  recipient: input.customerName.trim(),
                  phone: input.customerPhone.trim(),
                  email: input.customerEmail.trim().toLowerCase(),
                }
              : {
                  bio_address: input.bioAddress ?? "",
                  pickup_location: resolvedPickupLocation ?? vendorPickupAddress,
                  recipient: input.customerName.trim(),
                  phone: input.customerPhone.trim(),
                  email: input.customerEmail.trim().toLowerCase(),
                },
          ),
          resolvedPickupLocation,
          input.deliveryNotes || null,
          input.customerNotes || null,
          input.scheduledFor ? new Date(input.scheduledFor).toISOString() : null,
        ],
      );

      for (const item of group.items) {
        await db.execute(
          `insert into order_items
             (order_id, product_id, variant_id, kind, name, variant_name, unit_price, quantity,
              line_total, addons, measurements, reference_images, notes, duration_minutes)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14)`,
          [
            order.id,
            item.productId,
            item.variantId,
            item.kind,
            item.name,
            item.variantName,
            item.unitPrice,
            item.quantity,
            item.lineTotal,
            JSON.stringify(item.addons),
            JSON.stringify(item.measurements),
            JSON.stringify(item.referenceImages),
            item.notes,
            item.durationMinutes,
          ],
        );
      }

      await db.execute(
        `insert into order_status_history (order_id, from_status, to_status, actor_role, note)
         values ($1, null, 'placed', 'customer', 'Order placed')`,
        [order.id],
      );

      created.push({
        id: order.id,
        reference: order.reference,
        storeName: store.store_name,
        storeSlug: store.store_slug,
        total,
      });
      grandTotal = Number((grandTotal + total).toFixed(2));
    }

    // Keep the signed-in customer's bio details in sync for future checkouts
    await db.execute(
      `update users
          set full_name = coalesce(nullif($2, ''), full_name),
              phone = coalesce(nullif($3, ''), phone)
        where id = $1`,
      [customer.id, input.customerName.trim(), input.customerPhone.trim()],
    );
    await db.execute(
      `insert into customer_profiles (user_id, default_address, city, state)
       values ($1, $2::jsonb, $3, $4)
       on conflict (user_id) do update set
         default_address = excluded.default_address,
         city = coalesce(nullif(excluded.city, ''), customer_profiles.city),
         state = coalesce(nullif(excluded.state, ''), customer_profiles.state)`,
      [
        customer.id,
        JSON.stringify({
          address: input.address || input.bioAddress,
          bio_address: input.bioAddress,
          city: input.city || "Uyo",
          state: input.state || "Akwa Ibom",
          phone: input.customerPhone.trim(),
          recipient: input.customerName.trim(),
        }),
        input.city || null,
        input.state || "Akwa Ibom",
      ],
    );

    const paymentReference = (
      await db.one<{ ref: string }>(`select next_payment_reference('PAY') as ref`)
    ).ref;

    const provider = paymentMethod === "bank_transfer" ? "manual" : paystackSecret(settings) ? "paystack" : "sandbox";
    const payment = await db.one<{ id: string }>(
      `insert into payments
         (reference, scope, provider, checkout_reference, payer_user_id, payer_email, amount, currency,
          status, metadata)
       values ($1,'order',$2,$3,$4,$5,$6,$7,'pending',$8::jsonb)
       returning id`,
      [
        paymentReference,
        provider,
        checkoutReference,
        customer?.id ?? null,
        input.customerEmail.trim().toLowerCase(),
        grandTotal,
        settings.currency,
        JSON.stringify({ storeCount: created.length, orderIds: created.map((o) => o.id) }),
      ],
    );

    if (paymentMethod === "bank_transfer") {
      for (const order of created) {
        await db.execute(
          `insert into manual_order_payments (order_id, payment_id, customer_id, store_id, bank_name, account_name, account_number, amount)
           select o.id, $2, $3, o.store_id, v.bank_name, v.account_name, v.account_number, o.total
           from orders o join stores s on s.id = o.store_id join vendor_profiles v on v.user_id = s.owner_id where o.id = $1`,
          [order.id, payment.id, customer.id],
        );
        await db.execute(`update orders set platform_commission = 0, vendor_payable = 0 where id = $1`, [order.id]);
      }
    }
    return { checkoutReference, paymentReference, paymentId: payment.id, created, grandTotal };
  });

  // Start the payment *after* the transaction commits.
  let authorizationUrl = `/pay/${prepared.paymentReference}`;
  try {
    if (paymentMethod !== "bank_transfer") {
    const init = await initializeTransaction({
      reference: prepared.paymentReference,
      amount: prepared.grandTotal,
      email: input.customerEmail.trim().toLowerCase(),
      currency: settings.currency,
      callbackUrl: url(`/pay/callback?reference=${prepared.paymentReference}`),
      metadata: { checkoutReference: prepared.checkoutReference, purpose: "order" },
      secretKey: paystackSecret(settings),
    });
    authorizationUrl = init.authorizationUrl;
    await systemDb.execute(`update payments set authorization_url = $2 where id = $1`, [
      prepared.paymentId,
      authorizationUrl,
    ]);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment could not be initialised";
    await systemDb.execute(
      `update payments set status = 'failed', failure_reason = $2 where id = $1`,
      [prepared.paymentId, message],
    );
    throw new Error(message);
  }

  return {
    checkoutReference: prepared.checkoutReference,
    paymentReference: prepared.paymentReference,
    authorizationUrl,
    total: prepared.grandTotal,
    currency: settings.currency,
    orders: prepared.created,
  };
}

/* -------------------------------------------------------------------------- */
/* Fulfilment: mark orders paid, commit stock                                 */
/* -------------------------------------------------------------------------- */

export async function markOrdersPaid(
  db: Db,
  checkoutReference: string,
  paymentId: string,
  channel?: string | null,
  onlyOrderId?: string,
) {
  const orders = await db.query<Order & { store_name: string; owner_id: string; customer_email: string }>(
    `select o.*, s.name as store_name, s.owner_id
       from orders o join stores s on s.id = o.store_id
      where o.checkout_reference = $1 and ($2::uuid is null or o.id = $2)
      for update of o`,
    [checkoutReference, onlyOrderId ?? null],
  );

  for (const order of orders) {
    if (order.payment_status === "paid") continue;

    await db.execute(
      `update orders set payment_status = 'paid', status = 'payment_confirmed', amount_paid = total,
              accepted_at = accepted_at
        where id = $1`,
      [order.id],
    );
    await db.execute(
      `insert into order_status_history (order_id, from_status, to_status, actor_role, note)
       values ($1,$2,'payment_confirmed','system','Payment verified')`,
      [order.id, order.status],
    );
    await db.execute(
      `insert into payment_allocations (payment_id, order_id, store_id, amount)
       values ($1,$2,$3,$4) on conflict (payment_id, order_id) do nothing`,
      [paymentId, order.id, order.store_id, order.total],
    );
    if (channel !== "bank_transfer_direct") {
    await db.execute(
      `insert into platform_commissions (order_id, store_id, payment_id, rate, amount, status)
       select $1,$2,$3, $4, $5, 'accrued'
        where not exists (select 1 from platform_commissions where order_id = $1)`,
      [
        order.id,
        order.store_id,
        paymentId,
        Number(order.total) > 0
          ? Number(((Number(order.platform_commission) / Math.max(Number(order.subtotal), 1)) * 100).toFixed(2))
          : 0,
        order.platform_commission,
      ],
    );
    await db.execute(
      `insert into vendor_balances (store_id, pending_amount, lifetime_gross, lifetime_commission)
       values ($1,$2,$2,$3)
       on conflict (store_id) do update set
         pending_amount = vendor_balances.pending_amount + excluded.pending_amount,
         lifetime_gross = vendor_balances.lifetime_gross + excluded.lifetime_gross,
         lifetime_commission = vendor_balances.lifetime_commission + excluded.lifetime_commission,
         updated_at = now()`,
      [order.store_id, order.vendor_payable, order.platform_commission],
    );

    }

    if (!order.stock_committed) {
      const items = await db.query<OrderItem>(
        `select * from order_items where order_id = $1 and product_id is not null`,
        [order.id],
      );
      for (const item of items) {
        if (item.variant_id) {
          await db.execute(
            `update product_variants set stock_quantity = greatest(stock_quantity - $2, 0) where id = $1`,
            [item.variant_id, item.quantity],
          );
          await db.execute(
            `update products set stock_quantity = greatest(stock_quantity - $2, 0), sales_count = sales_count + $2
              where id = $1 and track_stock = true`,
            [item.product_id, item.quantity],
          );
        } else {
          await db.execute(
            `update products set stock_quantity = greatest(stock_quantity - $2, 0), sales_count = sales_count + $2
              where id = $1 and track_stock = true`,
            [item.product_id, item.quantity],
          );
        }
        await db.execute(
          `insert into inventory_movements (store_id, product_id, variant_id, delta, reason, order_id, note)
           values ($1,$2,$3,$4,'order_paid',$5,$6)`,
          [
            order.store_id,
            item.product_id,
            item.variant_id,
            -item.quantity,
            order.id,
            `Stock committed for ${order.reference}`,
          ],
        );
      }
      await db.execute(`update orders set stock_committed = true where id = $1`, [order.id]);
    }

    await notify(
      {
        userId: order.owner_id,
        storeId: order.store_id,
        type: "order_paid",
        title: `New paid order ${order.reference}`,
        body: `${order.customer_name} paid ₦${Number(order.total).toLocaleString()} for ${order.store_name}.`,
        actionUrl: `/vendor/orders/${order.id}`,
        dedupeKey: `order-paid-vendor:${order.id}`,
      },
      db,
    );

    await sendEmail({
      to: order.customer_email,
      template: "payment_confirmed",
      data: {
        name: order.customer_name,
        orderReference: order.reference,
        amount: order.total,
        currency: order.currency,
        link: url(`/track?reference=${order.reference}&contact=${encodeURIComponent(order.customer_email)}`),
      },
      dedupeKey: `order-paid-customer:${order.id}`,
    });
    await sendEmail({
      to: order.customer_email,
      template: "order_receipt",
      data: {
        name: order.customer_name,
        storeName: order.store_name,
        orderReference: order.reference,
        amount: order.total,
        currency: order.currency,
      },
      dedupeKey: `order-receipt:${order.id}`,
    });
    const owner = await db.maybeOne<{ email: string }>(`select email from users where id = $1`, [order.owner_id]);
    if (owner) {
      await sendEmail({
        to: owner.email,
        template: "order_vendor_new",
        data: {
          storeName: order.store_name,
          name: order.customer_name,
          orderReference: order.reference,
          amount: order.total,
          currency: order.currency,
        },
        dedupeKey: `order-new-vendor:${order.id}`,
      });
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Order reads                                                                */
/* -------------------------------------------------------------------------- */

export async function getOrderForActor(orderId: string, actor: { id: string; role: string; email: string }) {
  const order = await systemDb.maybeOne<
    Order & {
      store_name: string;
      store_slug: string;
      store_logo: string | null;
      store_address: string | null;
      store_city: string | null;
      store_state: string | null;
      store_phone: string | null;
      owner_email: string | null;
      category_id: string | null;
    }
  >(
    `select o.*, s.name as store_name, s.slug as store_slug, s.logo_url as store_logo,
            s.address as store_address, s.city as store_city, s.state as store_state, s.phone as store_phone,
            u.email as owner_email, s.category_id
       from orders o
       join stores s on s.id = o.store_id
       join users u on u.id = s.owner_id
      where o.id = $1`,
    [orderId],
  );
  if (!order) return null;
  const isOwner = order.owner_email?.toLowerCase() === actor.email.toLowerCase();
  const isCustomer =
    order.customer_id === actor.id || order.customer_email.toLowerCase() === actor.email.toLowerCase();
  const isAdmin = actor.role === "admin" || actor.role === "super_admin";
  if (!isOwner && !isCustomer && !isAdmin) return null;

  // Never expose the customer's secret delivery PIN to the vendor.
  if (isOwner && !isCustomer && !isAdmin) {
    delete order.delivery_pin;
  }

  const items = await systemDb.query<OrderItem>(`select * from order_items where order_id = $1`, [orderId]);
  const history = await systemDb.query<Order["history"] extends Array<infer T> ? T : never>(
    `select id, from_status, to_status, note, actor_role, created_at, customer_visible
       from order_status_history where order_id = $1 order by created_at`,
    [orderId],
  );
  const tracking = await systemDb.query<{
    id: string;
    status: string | null;
    message: string | null;
    location: string | null;
    carrier: string | null;
    tracking_number: string | null;
    occurred_at: string;
  }>(`select * from order_tracking where order_id = $1 order by occurred_at`, [orderId]);

  const category = order.category_id
    ? await systemDb.maybeOne<StoreCategory>(`select * from store_categories where id = $1`, [order.category_id])
    : null;

  return { order, items, history, tracking, category, isOwner, isCustomer, isAdmin };
}

/* -------------------------------------------------------------------------- */
/* Vendor order actions                                                       */
/* -------------------------------------------------------------------------- */

type ActionKey =
  | "accept"
  | "reject"
  | "preparing"
  | "production_start"
  | "production_complete"
  | "ready"
  | "dispatch"
  | "deliver"
  | "complete"
  | "cancel"
  | "progress"
  | "eta"
  | "tracking";

function isAfter(workflow: Array<{ key: string }>, current: string, target: string) {
  const keys = workflow.map((stage) => stage.key);
  const currentIndex = keys.indexOf(current);
  const targetIndex = keys.indexOf(target);
  if (targetIndex === -1) return false;
  if (currentIndex === -1) return true;
  return targetIndex > currentIndex;
}

export async function updateOrderByVendor(input: {
  orderId: string;
  action: ActionKey;
  note?: string;
  eta?: string;
  dispatchEta?: string;
  deliveryEta?: string;
  productionProgress?: number;
  trackingCarrier?: string;
  trackingNumber?: string;
  dispatchRiderName?: string;
  dispatchRiderPhone?: string;
  deliveryPin?: string;
}) {
  const ctx = await getVendorContext();
  const lockError = vendorSuspensionMessage(ctx);
  if (lockError) throw new Error(lockError);
  const order = await systemDb.maybeOne<Order & { delivery_pin: string }>(
    `select * from orders where id = $1 and store_id = $2`,
    [input.orderId, ctx.store.id],
  );
  if (!order) throw new Error("Order not found");

  const workflow = workflowFor(ctx.category);
  const stageKeys = workflow.map((stage) => stage.key);
  const resolve = (...options: string[]) => options.find((option) => stageKeys.includes(option)) ?? options[0];
  const isPaid = order.payment_status === "paid";

  let target: string | null = null;
  const timestampField: Partial<Record<ActionKey, string>> = {
    accept: "accepted_at",
    reject: "rejected_at",
    production_start: "production_started_at",
    production_complete: "production_completed_at",
    ready: "ready_at",
    dispatch: "dispatched_at",
    deliver: "delivered_at",
    complete: "completed_at",
    cancel: "cancelled_at",
  };

  switch (input.action) {
    case "accept":
      if (!["placed", "payment_confirmed"].includes(order.status)) throw new Error("This order can no longer be accepted");
      if (!isPaid) throw new Error("Payment must be confirmed before accepting the order");
      target = "accepted";
      break;
    case "reject":
      if (!["placed", "payment_confirmed"].includes(order.status)) throw new Error("This order can no longer be rejected");
      target = "rejected";
      break;
    case "preparing":
      target = resolve("preparing", "in_production");
      break;
    case "production_start":
      target = resolve("in_production", "preparing");
      break;
    case "production_complete":
      target = resolve("production_completed", "ready_for_dispatch");
      break;
    case "ready":
      target = resolve("ready_for_pickup", "ready_for_dispatch", "production_completed");
      break;
    case "dispatch":
      target = "dispatched";
      break;
    case "deliver":
    case "complete": {
      if (order.dispute_status === "open") {
        throw new Error(
          "This order has an open customer delivery dispute. Completion and payout release are paused until resolved.",
        );
      }
      const submittedPin = (input.deliveryPin ?? "").trim();
      if (!submittedPin || submittedPin !== String(order.delivery_pin ?? "").trim()) {
        throw new Error(
          "Enter the valid 6-digit Delivery / Pickup PIN from the customer to verify handover (or ask the customer to click 'Confirm Order Received' in their account).",
        );
      }
      target = resolve("completed", "delivered");
      break;
    }
    case "cancel":
      if (["delivered", "completed", "cancelled"].includes(order.status)) throw new Error("This order cannot be cancelled");
      target = "cancelled";
      break;
    case "progress":
    case "eta":
    case "tracking":
      target = null;
      break;
    default:
      throw new Error("Unsupported action");
  }

  if (target) {
    if (target === order.status) throw new Error(`Order is already ${workflowLabel(ctx.category, target)}`);
    if (!isAfter(workflow, order.status, target) && !["cancelled", "rejected"].includes(target)) {
      throw new Error(`You cannot move this order from ${workflowLabel(ctx.category, order.status)} to ${workflowLabel(ctx.category, target)}`);
    }
    if (!isPaid && !["cancelled", "rejected"].includes(target)) {
      throw new Error("Payment has not been confirmed for this order yet");
    }
  }

  const updates: string[] = [];
  const params: unknown[] = [input.orderId];

  if (target) {
    params.push(target);
    updates.push(`status = $${params.length}`);
    const field = timestampField[input.action];
    if (field) updates.push(`${field} = now()`);
  }
  if (input.action === "reject") {
    params.push(input.note ?? "Order could not be accepted");
    updates.push(`rejection_reason = $${params.length}`);
  }
  if (input.action === "cancel") {
    params.push(input.note ?? "Cancelled by vendor");
    updates.push(`cancellation_reason = $${params.length}`);
  }
  if (input.eta) {
    params.push(input.eta);
    updates.push(`estimated_completion_date = $${params.length}`);
  }
  if (input.dispatchEta) {
    params.push(input.dispatchEta);
    updates.push(`estimated_dispatch_date = $${params.length}`);
  }
  if (input.deliveryEta) {
    params.push(input.deliveryEta);
    updates.push(`estimated_delivery_date = $${params.length}`);
  }
  if (typeof input.productionProgress === "number") {
    params.push(input.productionProgress);
    updates.push(`production_progress = $${params.length}`);
  }
  if (input.trackingCarrier !== undefined) {
    params.push(input.trackingCarrier || null);
    updates.push(`tracking_carrier = $${params.length}`);
  }
  if (input.trackingNumber !== undefined) {
    params.push(input.trackingNumber || null);
    updates.push(`tracking_number = $${params.length}`);
  }
  if (input.dispatchRiderName !== undefined) {
    params.push(input.dispatchRiderName || null);
    updates.push(`dispatch_rider_name = $${params.length}`);
  }
  if (input.dispatchRiderPhone !== undefined) {
    params.push(input.dispatchRiderPhone || null);
    updates.push(`dispatch_rider_phone = $${params.length}`);
  }
  if (input.action === "deliver" || input.action === "complete") {
    updates.push(`delivered_at = coalesce(delivered_at, now())`);
    updates.push(`completed_at = coalesce(completed_at, now())`);
    updates.push(`delivery_confirmed_at = now()`);
    updates.push(`delivery_confirmed_by = 'pin'`);
    updates.push(`payout_released = true`);
  }
  if (input.action === "production_start" && order.production_started_at == null) {
    updates.push(`production_started_at = now()`);
  }
  if (input.action === "production_complete") {
    updates.push(`production_progress = 100`);
  }

  if (!updates.length) throw new Error("Nothing to update");

  await withSystem(async (db) => {
    await db.execute(
      `update orders set ${updates.join(", ")} where id = $1`,
      params,
    );

    await db.execute(
      `insert into order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
       values ($1,$2,$3,$4,'vendor',$5)`,
      [order.id, order.status, target ?? order.status, ctx.user.id, input.note || null],
    );

    if (input.action === "dispatch" && (input.trackingNumber || input.trackingCarrier)) {
      await db.execute(
        `insert into order_tracking (order_id, carrier, tracking_number, status, message)
         values ($1,$2,$3,'dispatched',$4)`,
        [order.id, input.trackingCarrier || null, input.trackingNumber || null, input.note || "Order dispatched"],
      );
    }

    if (target === "cancelled" || target === "rejected") {
      if (order.payment_status === "paid") {
        await db.execute(
          `insert into refunds (payment_id, order_id, store_id, amount, reason, status, requested_by)
           select p.id, $1, $2, $3, $4, 'requested', $5
             from payments p where p.checkout_reference = $6
            order by p.created_at desc limit 1`,
          [order.id, order.store_id, order.amount_paid || order.total, input.note ?? "Order cancelled", ctx.user.id, order.checkout_reference],
        );
        await notifyAdmins({
          storeId: order.store_id,
          type: "refund_requested",
          title: "Refund requested",
          body: `${ctx.store.name} cancelled paid order ${order.reference}. A refund of ₦${Number(order.amount_paid || order.total).toLocaleString()} is pending.`,
          actionUrl: "/admin/payments",
          dedupeKey: `refund-requested:${order.id}`,
        });
      }
      if (order.stock_committed) {
        const items = await db.query<OrderItem>(`select * from order_items where order_id = $1`, [order.id]);
        for (const item of items) {
          if (!item.product_id) continue;
          if (item.variant_id) {
            await db.execute(`update product_variants set stock_quantity = stock_quantity + $2 where id = $1`, [item.variant_id, item.quantity]);
          }
          await db.execute(`update products set stock_quantity = stock_quantity + $2, sales_count = greatest(sales_count - $2, 0) where id = $1`, [item.product_id, item.quantity]);
          await db.execute(
            `insert into inventory_movements (store_id, product_id, variant_id, delta, reason, order_id, note)
             values ($1,$2,$3,$4,'order_cancelled',$5,$6)`,
            [order.store_id, item.product_id, item.variant_id, item.quantity, order.id, "Stock restored after cancellation"],
          );
        }
        await db.execute(`update orders set stock_committed = false where id = $1`, [order.id]);
      }
    }

    if (["delivered", "completed"].includes(target ?? "") && !order.payout_released) {
      await db.execute(
        `update vendor_balances set
           available_amount = available_amount + $2,
           pending_amount = greatest(pending_amount - $2, 0),
           updated_at = now()
         where store_id = $1`,
        [order.store_id, order.vendor_payable],
      );
    }

    await logActivity(
      {
        actorId: ctx.user.id,
        actorRole: "vendor",
        storeId: ctx.store.id,
        action: `order.${input.action}`,
        entityType: "order",
        entityId: order.id,
        description: `${ctx.store.name} ${input.action} order ${order.reference}`,
        meta: { from: order.status, to: target, note: input.note },
      },
      db,
    );

    await notify(
      {
        userId: order.customer_id,
        storeId: order.store_id,
        type: "order_update",
        title: `Order ${order.reference} updated`,
        body: `${ctx.store.name}: ${workflowLabel(ctx.category, target ?? order.status)}`,
        actionUrl: `/account/orders/${order.id}`,
        dedupeKey: `order-update:${order.id}:${target ?? input.action}:${Date.now()}`,
      },
      db,
    );
  });

  // Emails
  const emailFor: Partial<Record<string, { template: string; data: Record<string, unknown> }>> = {
    accepted: {
      template: "order_accepted",
      data: { eta: order.estimated_completion_date ?? input.eta ?? "To be confirmed" },
    },
    rejected: { template: "order_rejected", data: { reason: input.note ?? order.rejection_reason ?? "" } },
    preparing: { template: "order_preparing", data: { eta: input.eta ?? "" } },
    production_start: { template: "production_started", data: { eta: input.eta ?? "" } },
    production_complete: { template: "production_completed", data: { eta: input.dispatchEta ?? "" } },
    ready: { template: "ready_for_pickup", data: { note: input.note ?? "" } },
    dispatch: {
      template: "order_dispatched",
      data: { eta: input.deliveryEta ?? "", note: input.note ?? "", code: input.trackingNumber ?? "" },
    },
    deliver: { template: "order_delivered", data: {} },
    cancel: { template: "order_cancelled", data: { reason: input.note ?? "" } },
    eta: { template: "eta_updated", data: { eta: input.eta ?? input.deliveryEta ?? "", note: input.note ?? "" } },
  };

  const mapping = emailFor[input.action];
  if (mapping) {
    await sendEmail({
      to: order.customer_email,
      template: mapping.template,
      data: {
        name: order.customer_name,
        storeName: ctx.store.name,
        orderReference: order.reference,
        currency: order.currency,
        ...mapping.data,
      },
      dedupeKey: `order-${input.action}:${order.id}:${target ?? ""}`,
    });
  }

  return { ok: true, status: target ?? order.status };
}

export async function getVendorOrderList(storeId: string, opts: { status?: string; search?: string; page?: number }) {
  const pageSize = 15;
  const page = Math.max(opts.page ?? 1, 1);
  const params: unknown[] = [storeId];
  let where = "where o.store_id = $1";
  if (opts.status && opts.status !== "all") {
    params.push(opts.status);
    where += ` and o.status = $${params.length}`;
  }
  if (opts.search) {
    params.push(`%${opts.search}%`);
    where += ` and (o.reference ilike $${params.length} or o.customer_name ilike $${params.length}
                  or o.customer_email ilike $${params.length} or o.customer_phone ilike $${params.length})`;
  }
  const total = await systemDb.one<{ count: number }>(
    `select count(*)::int as count from orders o ${where}`,
    params,
  );
  const rows = await systemDb.query<Order & { item_count: number }>(
    `select o.*, (select count(*)::int from order_items i where i.order_id = o.id) as item_count
       from orders o ${where}
      order by o.created_at desc
      limit ${pageSize} offset ${(page - 1) * pageSize}`,
    params,
  );
  return {
    orders: rows,
    total: total.count,
    page,
    pageSize,
    totalPages: Math.max(Math.ceil(total.count / pageSize), 1),
  };
}

export function orderStatusTone(status: string) {
  if (["delivered", "completed", "payment_confirmed", "accepted"].includes(status)) return "success";
  if (["cancelled", "rejected", "refunded", "expired"].includes(status)) return "danger";
  if (["in_production", "preparing", "dispatched", "in_service", "production_completed", "ready_for_pickup", "ready_for_dispatch", "awaiting_production"].includes(status)) return "info";
  return "warning";
}

/* -------------------------------------------------------------------------- */
/* Customer delivery confirmation & dispute reporting                         */
/* -------------------------------------------------------------------------- */

export async function confirmOrderDeliveryByCustomer(input: {
  orderId: string;
  actor: { id: string; email: string; fullName: string };
  note?: string;
}) {
  const order = await systemDb.maybeOne<Order & { store_name: string; owner_id: string }>(
    `select o.*, s.name as store_name, s.owner_id
       from orders o join stores s on s.id = o.store_id
      where o.id = $1`,
    [input.orderId],
  );
  if (!order) throw new Error("Order not found");
  const isCustomer =
    order.customer_id === input.actor.id ||
    order.customer_email.toLowerCase() === input.actor.email.toLowerCase();
  if (!isCustomer) throw new Error("You can only confirm orders placed on your account.");
  if (order.payment_status !== "paid") {
    throw new Error("Payment must be confirmed before confirming order receipt.");
  }
  if (["cancelled", "rejected", "refunded", "expired"].includes(order.status)) {
    throw new Error("This order can no longer be confirmed.");
  }
  if (order.delivery_confirmed_at && ["delivered", "completed"].includes(order.status)) {
    return { ok: true, alreadyConfirmed: true };
  }

  await withSystem(async (db) => {
    await db.execute(
      `update orders
          set status = 'completed',
              delivered_at = coalesce(delivered_at, now()),
              completed_at = coalesce(completed_at, now()),
              delivery_confirmed_at = now(),
              delivery_confirmed_by = 'customer',
              payout_released = true,
              dispute_status = case when dispute_status = 'open' then 'resolved' else dispute_status end
        where id = $1`,
      [order.id],
    );

    if (!order.payout_released) {
      await db.execute(
        `update vendor_balances set
           available_amount = available_amount + $2,
           pending_amount = greatest(pending_amount - $2, 0),
           updated_at = now()
         where store_id = $1`,
        [order.store_id, order.vendor_payable],
      );
    }

    await db.execute(
      `insert into order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
       values ($1, $2, 'completed', $3, 'customer', $4)`,
      [
        order.id,
        order.status,
        input.actor.id,
        input.note?.trim() || "Customer confirmed receipt of product",
      ],
    );

    await logActivity(
      {
        actorId: input.actor.id,
        actorRole: "customer",
        storeId: order.store_id,
        action: "order.customer_confirmed_delivery",
        entityType: "order",
        entityId: order.id,
        description: `${input.actor.fullName} confirmed receipt of order ${order.reference}`,
      },
      db,
    );

    await notify(
      {
        userId: order.owner_id,
        storeId: order.store_id,
        type: "order_delivered_confirmed",
        title: `Delivery confirmed — ${order.reference}`,
        body: `${order.customer_name} confirmed receiving their order. Settlement funds have been released to your available balance.`,
        actionUrl: `/vendor/orders/${order.id}`,
        dedupeKey: `customer-confirmed:${order.id}`,
      },
      db,
    );
  });

  return { ok: true };
}

export async function reportOrderIssueByCustomer(input: {
  orderId: string;
  actor: { id: string; email: string; fullName: string };
  reason: string;
  details?: string;
}) {
  const reason = input.reason.trim();
  if (reason.length < 5) throw new Error("Describe the delivery issue (at least 5 characters).");

  const order = await systemDb.maybeOne<Order & { store_name: string; owner_id: string }>(
    `select o.*, s.name as store_name, s.owner_id
       from orders o join stores s on s.id = o.store_id
      where o.id = $1`,
    [input.orderId],
  );
  if (!order) throw new Error("Order not found");
  const isCustomer =
    order.customer_id === input.actor.id ||
    order.customer_email.toLowerCase() === input.actor.email.toLowerCase();
  if (!isCustomer) throw new Error("You can only report issues on your own orders.");
  if (["delivered", "completed"].includes(order.status) && order.payout_released) {
    // Still allow filing a report for admin review even post-delivery
  }

  await withSystem(async (db) => {
    await db.execute(
      `update orders set dispute_status = 'open', dispute_reason = $2 where id = $1`,
      [order.id, reason],
    );

    await db.execute(
      `insert into reports (reporter_user_id, reporter_email, store_id, order_id, type, reason, details, status)
       values ($1, $2, $3, $4, 'order', $5, $6, 'open')`,
      [input.actor.id, input.actor.email, order.store_id, order.id, reason, input.details?.trim() || null],
    );

    await db.execute(
      `insert into customer_messages (store_id, order_id, customer_id, sender_name, sender_email, sender_role, category, subject, body)
       values ($1, $2, $3, $4, $5, 'customer', 'dispute', $6, $7)`,
      [
        order.store_id,
        order.id,
        input.actor.id,
        input.actor.fullName,
        input.actor.email,
        `Delivery dispute on order ${order.reference}: ${reason.slice(0, 80)}`,
        input.details?.trim() ? `${reason}\n\n${input.details.trim()}` : reason,
      ],
    );

    await notify(
      {
        userId: order.owner_id,
        storeId: order.store_id,
        type: "order_dispute",
        title: `Delivery issue reported — ${order.reference}`,
        body: `${order.customer_name} reported: ${reason.slice(0, 120)}`,
        actionUrl: `/vendor/orders/${order.id}`,
        dedupeKey: `order-dispute-vendor:${order.id}:${Date.now()}`,
      },
      db,
    );

    await notifyAdmins(
      {
        storeId: order.store_id,
        type: "order_dispute",
        title: `Customer delivery dispute — ${order.reference}`,
        body: `${order.customer_name} (${order.store_name}): ${reason.slice(0, 120)}`,
        actionUrl: `/admin/reports`,
        dedupeKey: `order-dispute-admin:${order.id}:${Date.now()}`,
      },
      db,
    );
  });

  return { ok: true };
}

