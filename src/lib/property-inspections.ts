import { systemDb, withSystem } from "@/lib/db";
import { parseOrderTiming, formatNigeriaTime } from "@/lib/order-timing";
import { notify } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { url } from "@/lib/settings";

export const PROPERTY_CATEGORY = "house-agents-realtors";
export const isPropertyCategory = (slug?: string | null) => slug === PROPERTY_CATEGORY;
export function validatePropertyAttributes(a: Record<string, string>) {
  if (!["For rent", "For sale"].includes(a.listing_type)) throw new Error("Choose For rent or For sale.");
  if (!a.property_type?.trim()) throw new Error("Choose a property type.");
  if (!a.property_location || a.property_location.trim().length < 5 || a.property_location.length > 500) throw new Error("Enter a property location, area and landmark (5–500 characters).");
  const periods = a.listing_type === "For sale" ? ["Total sale price"] : ["Per year", "Per month", "Per day"];
  if (!periods.includes(a.price_period)) throw new Error("Choose a price basis matching rent or sale.");
  if (!a.inspection_fee?.trim() || !Number.isFinite(Number(a.inspection_fee)) || Number(a.inspection_fee) < 0 || Number(a.inspection_fee) > 100000000) throw new Error("Enter a valid inspection fee, or 0 for a free inspection.");
  for (const key of ["bedrooms", "bathrooms"]) if (a[key] && (!Number.isInteger(Number(a[key])) || Number(a[key]) < 0 || Number(a[key]) > 100)) throw new Error("Bedrooms and bathrooms must be whole numbers from 0 to 100.");
  if ((a.additional_fees?.length ?? 0) > 2000) throw new Error("Keep other fees within 2,000 characters.");
}

export interface InspectionSlot { id: string; starts_at: string; ends_at: string; meeting_type: string; meeting_point: string; is_active: boolean; booked: boolean }
export async function inspectionSlots(productId: string, ownerId?: string): Promise<InspectionSlot[]> {
  return systemDb.query<InspectionSlot>(
    `select t.*, exists(select 1 from service_bookings b where b.inspection_slot_id=t.id and b.status <> 'cancelled') as booked
       from property_inspection_slots t join stores s on s.id=t.store_id
      where t.product_id=$1 and t.starts_at > now() and ($2::uuid is null or s.owner_id=$2)
        and ($2::uuid is not null or (t.is_active and not exists(select 1 from service_bookings b where b.inspection_slot_id=t.id and b.status <> 'cancelled')))
      order by t.starts_at limit 100`, [productId, ownerId ?? null],
  );
}

export async function addInspectionSlot(ownerId: string, productId: string, localTime: string, duration: number, meetingType: string, point: string) {
  const startsAt = parseOrderTiming(localTime);
  if (!Number.isInteger(duration) || duration < 15 || duration > 240) throw new Error("Inspection duration must be 15–240 minutes.");
  if (!["office", "agreed_location"].includes(meetingType) || point.trim().length < 5 || point.trim().length > 500) throw new Error("Choose a meeting type and enter its exact address / landmark (5–500 characters).");
  const endsAt = new Date(new Date(startsAt).getTime() + duration * 60000).toISOString();
  return withSystem(async db => {
    const p = await db.maybeOne<{ store_id: string }>(`select p.store_id from products p join stores s on s.id=p.store_id join store_categories c on c.id=coalesce(p.marketplace_category_id,s.category_id) where p.id=$1 and s.owner_id=$2 and c.slug=$3`, [productId, ownerId, PROPERTY_CATEGORY]);
    if (!p) throw new Error("Property not found or not owned by you.");
    // One agent cannot publish overlapping availability, even on another property.
    await db.query(`select pg_advisory_xact_lock(hashtext($1))`, [p.store_id]);
    const overlap = await db.maybeOne(`select id from property_inspection_slots where store_id=$1 and is_active and starts_at < $3 and ends_at > $2`, [p.store_id, startsAt, endsAt]);
    if (overlap) throw new Error("This overlaps another inspection slot for your agency. Choose another time.");
    return db.one<{ id: string }>(`insert into property_inspection_slots(store_id,product_id,starts_at,ends_at,meeting_type,meeting_point) values($1,$2,$3,$4,$5,$6) returning id`, [p.store_id, productId, startsAt, endsAt, meetingType, point.trim()]);
  });
}

export async function withdrawInspectionSlot(ownerId: string, slotId: string) {
  return withSystem(async db => {
    const slot = await db.maybeOne<{ id: string }>(`select t.id from property_inspection_slots t join stores s on s.id=t.store_id where t.id=$1 and s.owner_id=$2 for update of t`, [slotId, ownerId]);
    if (!slot) throw new Error("Inspection slot not found.");
    const booking = await db.maybeOne(`select id from service_bookings where inspection_slot_id=$1 and status <> 'cancelled'`, [slotId]);
    if (booking) throw new Error("This slot is booked. Cancel its booking first and contact the customer before withdrawing it.");
    await db.execute(`update property_inspection_slots set is_active=false where id=$1`, [slotId]);
  });
}

export async function reserveInspection(user: { id: string; email: string; fullName: string }, slotId: string, phone: string, notes: string) {
  if (!/^[+\d ()-]{7,25}$/.test(phone)) throw new Error("Enter a valid contact phone number.");
  if (notes.length > 1000) throw new Error("Keep your note within 1,000 characters.");
  const result = await withSystem(async db => {
    const slot = await db.maybeOne<{ id: string; store_id: string; product_id: string; starts_at: string; ends_at: string; meeting_type: string; meeting_point: string; owner_id: string; store_name: string; name: string; price: number; attributes: Record<string,string> }>(
      `select t.*,s.owner_id,s.name as store_name,p.name,p.price,p.attributes from property_inspection_slots t join products p on p.id=t.product_id and p.store_id=t.store_id join stores s on s.id=t.store_id join store_categories c on c.id=coalesce(p.marketplace_category_id,s.category_id) where t.id=$1 and t.is_active and t.starts_at>now() and p.is_available and c.slug=$2 for update of t`, [slotId, PROPERTY_CATEGORY]);
    if (!slot) throw new Error("That inspection slot is no longer available.");
    if (slot.owner_id === user.id) throw new Error("You cannot book an inspection with your own agency.");
    const live = await db.maybeOne(`select id from stores where id=$1 and store_is_live(id)`, [slot.store_id]);
    if (!live) throw new Error("This agency is not accepting inspections right now.");
    validatePropertyAttributes(slot.attributes);
    const occupied = await db.maybeOne(`select id from service_bookings where inspection_slot_id=$1 and status <> 'cancelled'`, [slotId]);
    if (occupied) throw new Error("Someone just booked this slot. Please choose another.");
    const date = new Date(new Date(slot.starts_at).getTime() + 3600000).toISOString();
    const details = { visitType: "Property inspection", fields: [
      { key:"listing_type",label:"Listing type",value:slot.attributes.listing_type },
      { key:"inspection_fee",label:"Inspection fee (pay directly to agent; not collected online)",value:`₦${Number(slot.attributes.inspection_fee).toLocaleString()}` },
      { key:"property_location",label:"Property location",value:slot.attributes.property_location },
      { key:"meeting_type",label:"Meeting point",value:slot.meeting_type === "office" ? "Agent’s office" : "Specified meeting location" },
    ] };
    const booking = await db.one<{id:string}>(`insert into service_bookings(store_id,product_id,customer_id,customer_name,customer_email,customer_phone,scheduled_date,scheduled_time,duration_minutes,location,notes,booking_details,status,inspection_slot_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,'requested',$13) returning id`, [slot.store_id,slot.product_id,user.id,user.fullName,user.email,phone,date.slice(0,10),date.slice(11,16),Math.round((new Date(slot.ends_at).getTime()-new Date(slot.starts_at).getTime())/60000),slot.meeting_point,notes || null,JSON.stringify(details),slotId]);
    return {slot,booking};
  });
  const message = `${result.slot.name} · ${formatNigeriaTime(result.slot.starts_at)} · Meet at ${result.slot.meeting_point}. Inspection fee: ₦${Number(result.slot.attributes.inspection_fee).toLocaleString()}, payable directly to the agent; nothing collected online. Await the agent’s confirmation.`;
  await notify({ userId:result.slot.owner_id,storeId:result.slot.store_id,type:"inspection_requested",title:"New property inspection request",body:`${user.fullName}: ${message}`,actionUrl:"/vendor/bookings",dedupeKey:`inspection-agent:${result.booking.id}` });
  await notify({ userId:user.id,storeId:result.slot.store_id,type:"inspection_requested",title:"Inspection requested",body:message,actionUrl:"/account/bookings",dedupeKey:`inspection-client:${result.booking.id}` });
  const agent = await systemDb.maybeOne<{email:string}>(`select email from users where id=$1`, [result.slot.owner_id]);
  if (agent) await sendEmail({to:agent.email,template:"inspection_requested",data:{subject:"New property inspection request",message:`${user.fullName} (${phone}): ${message}`,link:url("/vendor/bookings")},dedupeKey:`inspection-agent:${result.booking.id}`});
  await sendEmail({to:user.email,template:"inspection_requested",data:{subject:"Property inspection requested",message,link:url("/account/bookings")},dedupeKey:`inspection-client:${result.booking.id}`});
  return result.booking;
}
