import { withSystem } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { url } from "@/lib/settings";

export function formatNigeriaTime(value: string | Date): string {
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(value)) + " WAT";
}

/** datetime-local is explicitly interpreted as Nigeria time, never server/browser time. */
export function parseOrderTiming(value: string, now = Date.now()): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Choose a valid date and time in Nigeria time.");
  const date = new Date(`${value}:00+01:00`);
  if (!Number.isFinite(date.getTime()) || new Date(date.getTime() + 3600000).toISOString().slice(0, 16) !== value) throw new Error("Choose a valid date and time.");
  if (date.getTime() <= now) throw new Error("Choose a future arrival or pickup time.");
  if (date.getTime() > now + 366 * 86400000) throw new Error("Choose a time within the next year.");
  return date.toISOString();
}

export async function setOrderTiming(ownerId: string, orderId: string, localTime: string, note: string) {
  const expectedAt = parseOrderTiming(localTime);
  if (note.length > 500) throw new Error("Keep the note within 500 characters.");
  const result = await withSystem(async (db) => {
    const order = await db.maybeOne<{ id: string; reference: string; status: string; fulfilment_type: string; customer_id: string | null; customer_email: string; store_id: string; store_name: string; fulfilment_expected_at: string | null; fulfilment_timing_note: string | null; pickup_location: string | null }>(
      `select o.*, s.name as store_name from orders o join stores s on s.id=o.store_id where o.id=$1 and s.owner_id=$2 for update of o`, [orderId, ownerId],
    );
    if (!order) throw new Error("Order not found or does not belong to your store.");
    if (!["delivery", "pickup"].includes(order.fulfilment_type)) throw new Error("Arrival and pickup times apply to product delivery or pickup orders.");
    if (["cancelled", "rejected", "completed", "delivered", "refunded"].includes(order.status)) throw new Error("This order is closed; its fulfilment time cannot be changed.");
    const label = order.fulfilment_type === "pickup" ? "Pickup-ready time" : "Expected arrival at your location";
    const message = `${label}: ${formatNigeriaTime(expectedAt)}.${note.trim() ? ` ${note.trim()}` : ""}`;
    if (order.fulfilment_expected_at && new Date(order.fulfilment_expected_at).getTime() === new Date(expectedAt).getTime() && (order.fulfilment_timing_note ?? "") === note.trim()) return { order, changed: false, message };
    await db.execute(`update orders set fulfilment_expected_at=$2, fulfilment_timing_note=$3 where id=$1`, [orderId, expectedAt, note.trim() || null]);
    await db.execute(`insert into order_status_history(order_id,from_status,to_status,actor_id,actor_role,note) values($1,$2,$2,$3,'vendor',$4)`, [orderId, order.status, ownerId, message]);
    return { order, changed: true, message };
  });
  if (result.changed) {
    await notify({ userId: result.order.customer_id, storeId: result.order.store_id, type: "order_fulfilment_time", title: `${result.order.fulfilment_type === "pickup" ? "Pickup time" : "Delivery arrival time"} · ${result.order.reference}`, body: result.message, actionUrl: `/account/orders/${orderId}` });
    await sendEmail({ to: result.order.customer_email, template: "order_fulfilment_time", data: { orderReference: result.order.reference, storeName: result.order.store_name, message: result.message, status: result.order.fulfilment_type, eta: formatNigeriaTime(expectedAt), note: note.trim(), link: url(`/account/orders/${orderId}`), pickupLocation: result.order.pickup_location } });
  }
  return result;
}
