"use server";

import { requireActiveVendorContext } from "@/lib/auth";
import { setOrderTiming } from "@/lib/order-timing";
import { revalidatePath } from "next/cache";

export interface TimingState { error?: string; message?: string }
export async function updateOrderTimingAction(_previous: TimingState, form: FormData): Promise<TimingState> {
  const { user } = await requireActiveVendorContext();
  const id = String(form.get("orderId") ?? "");
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return { error: "Invalid order." };
  try {
    const result = await setOrderTiming(user.id, id, String(form.get("expectedAt") ?? ""), String(form.get("timingNote") ?? ""));
    revalidatePath(`/vendor/orders/${id}`);
    revalidatePath(`/account/orders/${id}`);
    revalidatePath("/account/notifications");
    revalidatePath("/track");
    return { message: result.changed ? "Time saved. The customer has been notified in their account and by email." : "This time has already been shared with the customer." };
  } catch (error) { return { error: error instanceof Error ? error.message : "Could not update the expected time." }; }
}
