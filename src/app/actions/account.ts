"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { logActivity } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";

export interface AccountState {
  error?: string;
  message?: string;
}

export async function saveAddressAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to save an address" };

  const id = String(formData.get("addressId") ?? "") || null;
  const recipient = String(formData.get("recipient") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const isDefault = formData.get("isDefault") === "on";

  if (recipient.length < 2) return { error: "Enter the recipient's name" };
  if (phone.length < 7) return { error: "Enter a valid phone number" };
  if (address.length < 5) return { error: "Enter a full street address" };

  try {
    const existing = await systemDb.maybeOne<{ count: number }>(
      `select count(*)::int as count from delivery_addresses where user_id = $1`,
      [user.id],
    );
    const makeDefault = isDefault || (existing?.count ?? 0) === 0;

    if (id) {
      await systemDb.execute(
        `update delivery_addresses set label=$3, recipient=$4, phone=$5, address=$6, city=$7, state=$8, is_default=$9
          where id=$1 and user_id=$2`,
        [id, user.id, label || null, recipient, phone, address, city || null, state || null, makeDefault],
      );
    } else {
        const created = await systemDb.one<{ id: string }>(
        `insert into delivery_addresses (user_id, label, recipient, phone, address, city, state, is_default)
         values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
        [user.id, label || null, recipient, phone, address, city || null, state || null, makeDefault],
      );
      if (makeDefault) {
        await systemDb.execute(`update delivery_addresses set is_default = false where user_id = $1 and id <> $2 and is_default`, [user.id, created.id]);
      }
    }
    if (makeDefault && id) {
      await systemDb.execute(`update delivery_addresses set is_default = false where user_id = $1 and id <> $2 and is_default`, [user.id, id]);
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Address could not be saved" };
  }

  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
  return { message: "Address saved." };
}

export async function deleteAddressAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const addressId = String(formData.get("addressId") ?? "");
  await systemDb.execute(`delete from delivery_addresses where id = $1 and user_id = $2`, [addressId, user.id]);
  revalidatePath("/account/addresses");
}

export async function setDefaultAddressAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const addressId = String(formData.get("addressId") ?? "");
  await systemDb.execute(`update delivery_addresses set is_default = (id = $2) where user_id = $1`, [user.id, addressId]);
  revalidatePath("/account/addresses");
}

export async function acceptQuotationAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const quotationId = String(formData.get("quotationId") ?? "");

  const quotation = await systemDb.maybeOne<{
    id: string;
    store_id: string;
    title: string | null;
    quoted_amount: number | null;
    customer_email: string;
    valid_until: string | null;
    status: string;
    owner_id: string;
    store_name: string;
    owner_email: string;
  }>(
    `select q.id, q.store_id, q.title, q.quoted_amount, q.customer_email, q.valid_until, q.status,
            s.owner_id, s.name as store_name, u.email as owner_email
       from service_quotations q join stores s on s.id = q.store_id join users u on u.id = s.owner_id
      where q.id = $1`,
    [quotationId],
  );
  if (!quotation) return;
  if (quotation.customer_email.toLowerCase() !== user.email.toLowerCase()) return;
  if (quotation.status !== "quoted") return;
  if (quotation.valid_until && new Date(quotation.valid_until).getTime() < Date.now()) return;

  await systemDb.execute(`update service_quotations set status = 'accepted', responded_at = now() where id = $1`, [quotationId]);
  await notify(
    {
      userId: quotation.owner_id,
      storeId: quotation.store_id,
      type: "quotation_accepted",
      title: "Quotation accepted",
      body: `${user.fullName} accepted your quote${quotation.quoted_amount ? ` for ₦${Number(quotation.quoted_amount).toLocaleString()}` : ""}.`,
      actionUrl: "/vendor/quotations",
      dedupeKey: `quote-accepted:${quotationId}`,
    },
  );
  await sendEmail({
    to: quotation.owner_email,
    template: "quote_accepted",
    data: {
      name: quotation.store_name,
      customerName: user.fullName,
      quoteTitle: quotation.title ?? "Custom request",
      quoteAmount: quotation.quoted_amount ?? 0,
      currency: "NGN",
    },
    dedupeKey: `quote-accepted:${quotationId}`,
  });
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    storeId: quotation.store_id,
    action: "quotation.accepted",
    entityType: "quotation",
    entityId: quotationId,
  });

  revalidatePath("/account/quotations");
  revalidatePath("/vendor/quotations");
}

export async function declineQuotationAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const quotationId = String(formData.get("quotationId") ?? "");
  const quotation = await systemDb.maybeOne<{ customer_email: string; status: string; store_id: string }>(
    `select customer_email, status, store_id from service_quotations where id = $1`,
    [quotationId],
  );
  if (!quotation || quotation.customer_email.toLowerCase() !== user.email.toLowerCase()) return;
  if (!["quoted", "requested"].includes(quotation.status)) return;
  await systemDb.execute(`update service_quotations set status = 'rejected' where id = $1`, [quotationId]);
  revalidatePath("/account/quotations");
}

export async function cancelBookingAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const bookingId = String(formData.get("bookingId") ?? "");
  const booking = await systemDb.maybeOne<{
    customer_email: string;
    status: string;
    store_id: string;
    owner_id: string;
    customer_name: string;
    scheduled_date: string;
    scheduled_time: string;
  }>(
    `select b.customer_email, b.status, b.store_id, b.customer_name, b.scheduled_date, b.scheduled_time, s.owner_id
       from service_bookings b join stores s on s.id = b.store_id where b.id = $1`,
    [bookingId],
  );
  if (!booking || booking.customer_email.toLowerCase() !== user.email.toLowerCase()) return;
  if (["cancelled", "completed", "no_show"].includes(booking.status)) return;

  await systemDb.execute(`update service_bookings set status = 'cancelled' where id = $1`, [bookingId]);
  await notify({
    userId: booking.owner_id,
    storeId: booking.store_id,
    type: "booking_cancelled",
    title: "Booking cancelled by customer",
    body: `${booking.customer_name} cancelled ${booking.scheduled_date} at ${booking.scheduled_time}.`,
    actionUrl: "/vendor/bookings",
    dedupeKey: `booking-customer-cancelled:${bookingId}`,
  });
  revalidatePath("/account/bookings");
  revalidatePath("/vendor/bookings");
}
