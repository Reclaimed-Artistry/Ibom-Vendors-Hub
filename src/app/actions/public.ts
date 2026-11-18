"use server";

import { redirect } from "next/navigation";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { systemDb, withActor, withSystem, withPublic } from "@/lib/db";
import { getSettings, paystackSecret, url } from "@/lib/settings";
import { initializeTransaction } from "@/lib/payments/gateway";
import {
  confirmOrderDeliveryByCustomer,
  createCheckout,
  reportOrderIssueByCustomer,
} from "@/lib/orders";
import { payWithWalletCheckout } from "@/lib/wallet-payments";
import { sendEmail } from "@/lib/email";
import { notify, notifyAdmins } from "@/lib/notifications";
import { logActivity } from "@/lib/audit";
import { formatIssues, bookingSchema, checkoutSchema, messageSchema, quotationRequestSchema, reviewSchema } from "@/lib/validation";
import { getCategoryBookingProfile } from "@/lib/artisan-bookings";

export interface PublicState {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  redirectUrl?: string;
}

/* -------------------------------------------------------------------------- */
/* Checkout                                                                   */
/* -------------------------------------------------------------------------- */
export async function submitCheckoutAction(_prev: PublicState, formData: FormData): Promise<PublicState> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      error: "Please sign in to your account before checking out.",
      redirectUrl: "/login?next=%2Fcheckout",
    };
  }

  const rawItems = String(formData.get("items") ?? "[]");
  let items: unknown = [];
  try {
    items = JSON.parse(rawItems);
  } catch {
    return { error: "Your cart could not be read. Please refresh and try again." };
  }

  const parsed = checkoutSchema.safeParse({
    items,
    customerName: formData.get("customerName"),
    customerEmail: formData.get("customerEmail") || user.email,
    customerPhone: formData.get("customerPhone"),
    bioAddress: formData.get("bioAddress") ?? "",
    fulfilmentType: formData.get("fulfilmentType") || "delivery",
    address: formData.get("address") ?? "",
    city: formData.get("city") ?? "",
    state: formData.get("state") ?? "",
    pickupLocation: formData.get("pickupLocation") ?? "",
    deliveryNotes: formData.get("deliveryNotes") ?? "",
    customerNotes: formData.get("customerNotes") ?? "",
    scheduledFor: formData.get("scheduledFor") ?? "",
  });

  if (!parsed.success) {
    return { error: "Please check your bio and fulfilment details", fieldErrors: formatIssues(parsed.error) };
  }

  const paymentMethod = String(formData.get("paymentMethod") ?? "bank_transfer");
  if (!["wallet", "bank_transfer"].includes(paymentMethod)) return { error: "Choose bank transfer or wallet payment." };

  let paymentPortal: string | null = null;
  try {
    const result = await withSystem(async () => {
    const checkout = await createCheckout(parsed.data, {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
    }, paymentMethod as "bank_transfer" | "wallet");
    if (paymentMethod === "wallet") await payWithWalletCheckout({ userId: user.id, email: user.email, checkoutReference: checkout.checkoutReference, grandTotal: checkout.total });
    return checkout;
    });

    // Wallet payment: deduct from wallet balance and confirm the order(s)
    // without touching PayStack at all.
    if (paymentMethod === "wallet") {
      revalidatePath("/account/wallet");
      revalidatePath("/account/orders");
      return {
        message: `Paid ₦${result.total.toLocaleString()} from your wallet. Your order is confirmed.`,
        redirectUrl: "/account/orders",
      };
    }

    paymentPortal = result.authorizationUrl;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Checkout failed. Please try again." };
  }
  // Server navigation guarantees the authenticated portal opens after commit;
  // it does not depend on a client effect or form-state hydration.
  if (paymentPortal) redirect(paymentPortal);
  return { error: "Could not open the payment portal. Please try again." };
}

/* -------------------------------------------------------------------------- */
/* Contact / support                                                          */
/* -------------------------------------------------------------------------- */
export async function submitContactAction(_prev: PublicState, formData: FormData): Promise<PublicState> {
  const parsed = messageSchema.safeParse({
    storeId: formData.get("storeId") ?? "",
    orderId: formData.get("orderId") ?? "",
    senderName: formData.get("senderName"),
    senderEmail: formData.get("senderEmail"),
    subject: formData.get("subject"),
    body: formData.get("body"),
    category: formData.get("category") || "inquiry",
  });
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields", fieldErrors: formatIssues(parsed.error) };
  }
  const settings = await getSettings();
  const user = await getCurrentUser();

  const storeId = parsed.data.storeId && parsed.data.storeId !== "" ? parsed.data.storeId : null;
  const orderId = parsed.data.orderId && parsed.data.orderId !== "" ? parsed.data.orderId : null;

  await withSystem(async (db) => {
    const message = await db.one<{ id: string }>(
      `insert into customer_messages
         (store_id, order_id, customer_id, sender_name, sender_email, sender_role, category, subject, body)
       values ($1,$2,$3,$4,$5,'customer',$6,$7,$8)
       returning id`,
      [
        storeId,
        orderId,
        user?.id ?? null,
        parsed.data.senderName,
        parsed.data.senderEmail.toLowerCase(),
        parsed.data.category,
        parsed.data.subject,
        parsed.data.body,
      ],
    );
    await logActivity(
      { actorId: user?.id ?? null, actorRole: user ? "customer" : "system", storeId, action: "message.received", entityType: "message", entityId: message.id },
      db,
    );
    if (storeId) {
      const store = await db.maybeOne<{ owner_id: string; name: string }>(`select owner_id, name from stores where id = $1`, [storeId]);
      if (store) {
        await notify(
          {
            userId: store.owner_id,
            storeId,
            type: "message",
            title: `New message from ${parsed.data.senderName}`,
            body: parsed.data.subject,
            actionUrl: `/vendor/messages`,
            dedupeKey: `message:${message.id}`,
          },
          db,
        );
        const owner = await db.maybeOne<{ email: string }>(`select email from users where id = $1`, [store.owner_id]);
        if (owner) {
          await sendEmail({
            to: owner.email,
            template: "message_received",
            data: { name: parsed.data.senderName, email: parsed.data.senderEmail, storeName: store.name, subject: parsed.data.subject, message: parsed.data.body, link: url("/vendor/messages") },
            dedupeKey: `message-email:${message.id}`,
          });
        }
      }
    }
  });

  await sendEmail({
    to: settings.support_email,
    template: "message_received",
    data: {
      name: parsed.data.senderName,
      email: parsed.data.senderEmail,
      subject: parsed.data.subject,
      message: parsed.data.body,
      link: url("/admin/reports"),
    },
    dedupeKey: `support-message:${Date.now()}:${parsed.data.senderEmail}`,
  });

  return { message: "Thank you — your message has been received. Our team replies within one business day." };
}

/* -------------------------------------------------------------------------- */
/* Quotations                                                                 */
/* -------------------------------------------------------------------------- */
export async function submitQuotationAction(_prev: PublicState, formData: FormData): Promise<PublicState> {
  const storeId = String(formData.get("storeId") ?? "");
  const parsed = quotationRequestSchema.safeParse({
    productId: formData.get("productId") ?? "",
    customerName: formData.get("customerName"),
    customerEmail: formData.get("customerEmail"),
    customerPhone: formData.get("customerPhone"),
    title: formData.get("title"),
    description: formData.get("description"),
    budget: formData.get("budget") || undefined,
    preferredDate: formData.get("preferredDate") ?? "",
    referenceImages: [],
  });
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields", fieldErrors: formatIssues(parsed.error) };
  }

  const store = await systemDb.maybeOne<{ id: string; owner_id: string; name: string }>(
    `select id, owner_id, name from stores where id = $1 and status = 'active'`,
    [storeId],
  );
  if (!store) return { error: "This store is not accepting requests right now." };

  const user = await getCurrentUser();
  const quotation = await withSystem(async (db) => {
    const row = await db.one<{ id: string }>(
      `insert into service_quotations
         (store_id, product_id, customer_id, customer_name, customer_email, customer_phone, title,
          description, budget, preferred_date, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'requested')
       returning id`,
      [
        store.id,
        parsed.data.productId && parsed.data.productId !== "" ? parsed.data.productId : null,
        user?.id ?? null,
        parsed.data.customerName,
        parsed.data.customerEmail.toLowerCase(),
        parsed.data.customerPhone,
        parsed.data.title,
        parsed.data.description,
        parsed.data.budget ?? null,
        parsed.data.preferredDate && parsed.data.preferredDate !== "" ? parsed.data.preferredDate : null,
      ],
    );
    await notify(
      {
        userId: store.owner_id,
        storeId: store.id,
        type: "quotation_requested",
        title: "New quotation request",
        body: `${parsed.data.customerName}: ${parsed.data.title}`,
        actionUrl: "/vendor/quotations",
        dedupeKey: `quote-request:${row.id}`,
      },
      db,
    );
    const owner = await db.maybeOne<{ email: string }>(`select email from users where id = $1`, [store.owner_id]);
    if (owner) {
      await sendEmail({
        to: owner.email,
        template: "quote_requested",
        data: { storeName: store.name, name: parsed.data.customerName, message: parsed.data.title, link: url("/vendor/quotations") },
        dedupeKey: `quote-request-email:${row.id}`,
      });
    }
    return row;
  });

  revalidatePath("/vendor/quotations");
  return { message: `Request sent to ${store.name}. You will receive a quotation by email — reference ${quotation.id.slice(0, 8).toUpperCase()}.` };
}

export async function acceptQuotationAction(_prev: PublicState, formData: FormData): Promise<PublicState> {
  const quotationId = String(formData.get("quotationId") ?? "");
  const settings = await getSettings();
  const quotation = await systemDb.maybeOne<{
    id: string;
    store_id: string;
    product_id: string | null;
    customer_id: string | null;
    customer_name: string;
    customer_email: string;
    customer_phone: string | null;
    title: string;
    quoted_amount: number;
    status: string;
    valid_until: string | null;
    store_name: string;
    store_slug: string;
  }>(
    `select q.*, s.name as store_name, s.slug as store_slug
       from service_quotations q join stores s on s.id = q.store_id where q.id = $1`,
    [quotationId],
  );
  if (!quotation) return { error: "Quotation not found" };
  if (quotation.status !== "quoted") return { error: "This quotation can no longer be accepted" };
  if (quotation.valid_until && new Date(quotation.valid_until) < new Date()) {
    return { error: "This quotation has expired. Ask the vendor for a new one." };
  }

  const created = await withSystem(async (db) => {
    const checkoutRef = (await db.one<{ ref: string }>(`select next_checkout_reference() as ref`)).ref;
    const total = Number(quotation.quoted_amount);
    const commission = Number((total * (Number(settings.commission_rate) / 100)).toFixed(2));
    const order = await db.one<{ id: string; reference: string }>(
      `insert into orders
         (checkout_reference, store_id, customer_id, customer_name, customer_email, customer_phone,
          status, payment_status, fulfilment_type, subtotal, total, platform_commission, vendor_payable, customer_notes)
       values ($1,$2,$3,$4,$5,$6,'placed','pending','service',$7,$7,$8,$9,$10)
       returning id, reference`,
      [
        checkoutRef,
        quotation.store_id,
        quotation.customer_id,
        quotation.customer_name,
        quotation.customer_email,
        quotation.customer_phone ?? "",
        total,
        commission,
        Number((total - commission).toFixed(2)),
        `Accepted quotation: ${quotation.title}`,
      ],
    );
    await db.execute(
      `insert into order_items (order_id, product_id, kind, name, unit_price, quantity, line_total, notes)
       values ($1,$2,'service',$3,$4,1,$4,$5)`,
      [order.id, quotation.product_id, quotation.title, total, `Quotation ${quotation.id}`],
    );
    await db.execute(
      `insert into order_status_history (order_id, to_status, actor_role, note) values ($1,'placed','customer','Quotation accepted')`,
      [order.id],
    );
    await db.execute(`update service_quotations set status='accepted', order_id=$2, responded_at=now() where id=$1`, [
      quotation.id,
      order.id,
    ]);
    await notify(
      {
        userId: null,
        storeId: quotation.store_id,
        type: "quotation_accepted",
        title: "Quotation accepted",
        body: `${quotation.customer_name} accepted your quotation of ₦${total.toLocaleString()}.`,
        actionUrl: `/vendor/orders/${order.id}`,
        dedupeKey: `quote-accepted:${quotation.id}`,
      },
      db,
    );

    const reference = (await db.one<{ ref: string }>(`select next_payment_reference('PAY') as ref`)).ref;
    const payment = await db.one<{ id: string }>(
      `insert into payments (reference, scope, provider, checkout_reference, payer_user_id, payer_email, amount, currency, status, metadata)
       values ($1,'order',$2,$3,$4,$5,$6,$7,'pending',$8::jsonb) returning id`,
      [
        reference,
        paystackSecret(settings) ? "paystack" : "sandbox",
        checkoutRef,
        quotation.customer_id,
        quotation.customer_email,
        total,
        settings.currency,
        JSON.stringify({ quotationId: quotation.id, purpose: "quotation" }),
      ],
    );
    return { order, reference, paymentId: payment.id, checkoutRef, total };
  });

  const init = await initializeTransaction({
    reference: created.reference,
    amount: created.total,
    email: quotation.customer_email,
    currency: settings.currency,
    callbackUrl: url(`/pay/callback?reference=${created.reference}`),
    metadata: { quotationId: quotation.id },
    secretKey: paystackSecret(settings),
  });
  await systemDb.execute(`update payments set authorization_url = $2 where id = $1`, [created.paymentId, init.authorizationUrl]);

  return { redirectUrl: init.authorizationUrl };
}

/* -------------------------------------------------------------------------- */
/* Bookings                                                                   */
/* -------------------------------------------------------------------------- */
export async function submitBookingAction(_prev: PublicState, formData: FormData): Promise<PublicState> {
  const storeId = String(formData.get("storeId") ?? "");
  const parsed = bookingSchema.safeParse({
    meetingPreference: formData.get("meetingPreference"),
    productId: formData.get("productId"),
    customerName: formData.get("customerName"),
    customerEmail: formData.get("customerEmail"),
    customerPhone: formData.get("customerPhone"),
    date: formData.get("date"),
    time: formData.get("time"),
    location: formData.get("location") ?? "",
    visitType: formData.get("visitType") ?? "",
    materialsOption: formData.get("materialsOption") ?? "",
    requirementsAccepted: formData.get("requirementsAccepted") === "on" || formData.get("requirementsAccepted") === "true",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields", fieldErrors: formatIssues(parsed.error) };
  }

  const store = await systemDb.maybeOne<{
    id: string;
    owner_id: string;
    name: string;
    category_slug: string | null;
  }>(
    `select s.id, s.owner_id, s.name, c.slug as category_slug
       from stores s
       left join store_categories c on c.id = s.category_id
      where s.id = $1 and s.status = 'active'`,
    [storeId],
  );
  if (!store) return { error: "This store is not accepting bookings right now." };
  const bookableStore = await withPublic((db) => db.maybeOne<{ id: string }>(
    `select id from stores where id = $1`, [store.id],
  ));
  if (!bookableStore) return { error: "This store is not accepting bookings right now." };

  const profile = getCategoryBookingProfile(store.category_slug);
  const fieldErrors: Record<string, string> = {};

  if (parsed.data.meetingPreference === "customer_location" && (!parsed.data.location || parsed.data.location.trim().length < 5)) {
    fieldErrors.location = "Please enter the job site address, area/LGA and nearest landmark";
  }

  const extraAnswers: Array<{ key: string; label: string; value: string }> = [{
    key: "meeting_preference",
    label: "Service meeting location",
    value: parsed.data.meetingPreference === "customer_location"
      ? "Professional visits customer at their home / office / venue"
      : "Customer visits professional at their office / studio",
  }];
  for (const field of profile.extraFields) {
    const rawVal = String(formData.get(`extra_${field.key}`) ?? "").trim();
    if (field.required && !rawVal) {
      fieldErrors[`extra_${field.key}`] = `${field.label} is required for this service`;
    } else if (rawVal) {
      extraAnswers.push({ key: field.key, label: field.label, value: rawVal.slice(0, 300) });
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Please complete all required service booking details", fieldErrors };
  }

  const product = await systemDb.maybeOne<{ id: string; name: string; service_duration_minutes: number | null }>(
    `select id, name, service_duration_minutes from products where id = $1 and store_id = $2 and is_available and (kind = 'service' or exists (select 1 from stores s join store_categories c on c.id = s.category_id where s.id = products.store_id and c.features->>'serviceBooking' = 'true'))`,
    [parsed.data.productId, store.id],
  );
  if (!product) return { error: "That service is no longer available." };

  const bookingDetails = {
    categorySlug: store.category_slug,
    visitType: parsed.data.visitType || null,
    materialsOption: parsed.data.materialsOption || null,
    requirementsAccepted: true,
    fields: extraAnswers,
  };

  const user = await getCurrentUser();
  await withSystem(async (db) => {
    const booking = await db.one<{ id: string }>(
      `insert into service_bookings
         (store_id, product_id, customer_id, customer_name, customer_email, customer_phone,
          scheduled_date, scheduled_time, duration_minutes, location, notes, booking_details, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,'requested') returning id`,
      [
        store.id,
        product.id,
        user?.id ?? null,
        parsed.data.customerName,
        parsed.data.customerEmail.toLowerCase(),
        parsed.data.customerPhone,
        parsed.data.date,
        parsed.data.time,
        product.service_duration_minutes,
        parsed.data.location || null,
        parsed.data.notes || null,
        JSON.stringify(bookingDetails),
      ],
    );
    await notify(
      {
        userId: store.owner_id,
        storeId: store.id,
        type: "booking_requested",
        title: profile.isArtisan ? "New artisan service booking" : "New appointment request",
        body: `${parsed.data.customerName} — ${product.name} on ${parsed.data.date} at ${parsed.data.time}${parsed.data.location ? ` (${parsed.data.location})` : ""}`,
        actionUrl: "/vendor/bookings",
        dedupeKey: `booking:${booking.id}`,
      },
      db,
    );
  });

  return { message: `Booking request sent to ${store.name}. You will receive a confirmation by email.` };
}

/* -------------------------------------------------------------------------- */
/* Reviews                                                                    */
/* -------------------------------------------------------------------------- */
export async function submitReviewAction(_prev: PublicState, formData: FormData): Promise<PublicState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to leave a review — only logged-in verified buyers can review purchases." };

  const parsed = reviewSchema.safeParse({
    orderId: formData.get("orderId"),
    productId: formData.get("productId") ?? "",
    rating: formData.get("rating"),
    title: formData.get("title") ?? "",
    comment: formData.get("comment"),
  });
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields", fieldErrors: formatIssues(parsed.error) };
  }

  const order = await systemDb.maybeOne<{
    id: string;
    store_id: string;
    customer_id: string | null;
    customer_email: string;
    status: string;
    store_slug: string;
  }>(
    `select o.id, o.store_id, o.customer_id, o.customer_email, o.status, s.slug as store_slug
       from orders o join stores s on s.id = o.store_id
      where o.id = $1`,
    [parsed.data.orderId],
  );
  if (!order) return { error: "Order not found" };

  const ownsOrder =
    order.customer_id === user.id || order.customer_email.toLowerCase() === user.email.toLowerCase();
  if (!ownsOrder) {
    return { error: "You can only review purchases made on your own account." };
  }
  if (!["delivered", "completed"].includes(order.status)) {
    return { error: "Reviews unlock after your order has been delivered and confirmed." };
  }

  const productId = parsed.data.productId && parsed.data.productId !== "" ? parsed.data.productId : null;
  let productSlug: string | null = null;
  if (productId) {
    const purchasedItem = await systemDb.maybeOne<{ slug: string }>(
      `select p.slug
         from order_items oi join products p on p.id = oi.product_id
        where oi.order_id = $1 and oi.product_id = $2
        limit 1`,
      [order.id, productId],
    );
    if (!purchasedItem) {
      return { error: "That item was not part of this order." };
    }
    productSlug = purchasedItem.slug;
  }

  try {
    await withActor({ id: user.id, role: "customer", email: user.email }, async (db) => {
      await db.execute(
        `insert into reviews (store_id, product_id, order_id, customer_id, customer_name, customer_email,
                              rating, title, comment, status, verified_purchase)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'published',true)`,
        [
          order.store_id,
          productId,
          order.id,
          user.id,
          user.fullName,
          user.email,
          parsed.data.rating,
          parsed.data.title || null,
          parsed.data.comment,
        ],
      );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("duplicate key")) return { error: "You have already reviewed this purchase." };
    if (message.includes("row-level security")) {
      return { error: "Only signed-in customers with a completed purchase can review this item." };
    }
    return { error: "Review could not be saved. Please try again." };
  }

  const owner = await systemDb.maybeOne<{ email: string; name: string }>(
    `select u.email, s.name from stores s join users u on u.id = s.owner_id where s.id = $1`,
    [order.store_id],
  );
  if (owner) {
    await sendEmail({
      to: owner.email,
      template: "review_received",
      data: { storeName: owner.name, name: user.fullName, amount: parsed.data.rating, message: parsed.data.comment },
      dedupeKey: `review-received:${order.id}:${productId ?? "store"}`,
    });
  }

  revalidatePath(`/account/orders/${order.id}`);
  revalidatePath(`/account/reviews`);
  revalidatePath(`/s/${order.store_slug}`);
  revalidatePath(`/s/${order.store_slug}/reviews`);
  if (productSlug) revalidatePath(`/s/${order.store_slug}/products/${productSlug}`);
  return { message: "Thank you! Your verified purchase review is now live." };
}

export async function confirmOrderDeliveryAction(_prev: PublicState, formData: FormData): Promise<PublicState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in to confirm delivery." };

  const orderId = String(formData.get("orderId") ?? "");
  const note = String(formData.get("note") ?? "");
  try {
    await confirmOrderDeliveryByCustomer({
      orderId,
      actor: { id: user.id, email: user.email, fullName: user.fullName },
      note,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not confirm delivery." };
  }

  revalidatePath(`/account/orders/${orderId}`);
  revalidatePath(`/vendor/orders/${orderId}`);
  revalidatePath(`/account/orders`);
  revalidatePath(`/account/reviews`);
  return { message: "Delivery confirmed! Vendor payout has been released and you can now leave a review below." };
}

export async function reportOrderDeliveryIssueAction(_prev: PublicState, formData: FormData): Promise<PublicState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in to report an order issue." };

  const orderId = String(formData.get("orderId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const details = String(formData.get("details") ?? "");
  try {
    await reportOrderIssueByCustomer({
      orderId,
      actor: { id: user.id, email: user.email, fullName: user.fullName },
      reason,
      details,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not submit delivery dispute." };
  }

  revalidatePath(`/account/orders/${orderId}`);
  revalidatePath(`/vendor/orders/${orderId}`);
  return { message: "Delivery dispute recorded. Payout is held while our team and the vendor investigate." };
}

/* -------------------------------------------------------------------------- */
/* Notifications                                                              */
/* -------------------------------------------------------------------------- */
export async function markNotificationReadAction(notificationId: string) {
  const user = await getCurrentUser();
  if (!user) return;
  await systemDb.execute(
    `update notifications set read_at = now() where id = $1 and user_id = $2`,
    [notificationId, user.id],
  );
  revalidatePath("/vendor");
  revalidatePath("/account");
  revalidatePath("/admin");
}
