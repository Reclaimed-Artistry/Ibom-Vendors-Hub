"use server";

import { getCurrentUser, requireActiveVendorContext } from "@/lib/auth";
import { addInspectionSlot, reserveInspection, withdrawInspectionSlot } from "@/lib/property-inspections";
import { revalidatePath } from "next/cache";

export interface InspectionState { error?: string; message?: string }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function refresh() { revalidatePath("/vendor/products", "layout"); revalidatePath("/vendor/bookings"); revalidatePath("/account/bookings"); revalidatePath("/s", "layout"); }
export async function saveInspectionSlotAction(_prev: InspectionState, form: FormData): Promise<InspectionState> {
  const ctx = await requireActiveVendorContext();
  const productId = String(form.get("productId") ?? "");
  if (!uuid.test(productId)) return { error:"Save the property before adding inspection slots." };
  try {
    await addInspectionSlot(ctx.user.id, productId, String(form.get("startsAt") ?? ""), Number(form.get("duration")), String(form.get("meetingType") ?? ""), String(form.get("meetingPoint") ?? ""));
    refresh(); return { message:"Inspection slot published. Times are Nigeria time (WAT)." };
  } catch(error) { return { error:error instanceof Error ? error.message : "Could not publish slot." }; }
}
export async function withdrawInspectionSlotAction(_prev: InspectionState, form: FormData): Promise<InspectionState> {
  const ctx = await requireActiveVendorContext();
  const slotId = String(form.get("slotId") ?? "");
  if (!uuid.test(slotId)) return { error:"Choose a valid slot." };
  try { await withdrawInspectionSlot(ctx.user.id, slotId); refresh(); return { message:"Slot withdrawn." }; }
  catch(error) { return { error:error instanceof Error ? error.message : "Could not withdraw slot." }; }
}
export async function bookInspectionAction(_prev: InspectionState, form: FormData): Promise<InspectionState> {
  const user = await getCurrentUser();
  if (!user) return { error:"Please sign in before booking an inspection." };
  const slotId = String(form.get("slotId") ?? "");
  if (!uuid.test(slotId)) return { error:"Choose an available inspection slot." };
  try {
    await reserveInspection(user, slotId, String(form.get("phone") ?? "").trim(), String(form.get("notes") ?? "").trim());
    refresh(); return { message:"Inspection requested. Your selected time and meeting point are in My bookings. No payment has been collected. Await the agent’s confirmation." };
  } catch(error) { return { error:error instanceof Error ? error.message : "Could not book this slot. Refresh and try again." }; }
}
