"use server";

import { getCurrentUser, requireActiveVendorContext } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { reviewManualTransfer, submitManualReceipt } from "@/lib/manual-payments";

export interface TransferState { error?: string; message?: string }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function uploadTransferReceiptAction(_previous: TransferState, form: FormData): Promise<TransferState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to upload your receipt." };
  try {
    const id = String(form.get("transferId") ?? "");
    if (!UUID.test(id)) throw new Error("Invalid payment reference.");
    const file = form.get("receipt");
    if (!(file instanceof File) || !file.size) throw new Error("Please choose your payment receipt.");
    if (file.size > 2 * 1024 * 1024) throw new Error("Receipt must be no larger than 2 MB.");
    const row = await submitManualReceipt(user.id, id, Buffer.from(await file.arrayBuffer()));
    revalidatePath(`/pay/${row.payment_reference}`);
    revalidatePath("/vendor/payment-approvals");
    return { message: "Receipt received. Awaiting payment approval." };
  } catch (error) { return { error: error instanceof Error ? error.message : "Receipt could not be submitted. Please retry." }; }
}

export async function reviewTransferAction(_previous: TransferState, form: FormData): Promise<TransferState> {
  const { user } = await requireActiveVendorContext();
  try {
    const id = String(form.get("transferId") ?? "");
    const decision = String(form.get("decision") ?? "");
    const note = String(form.get("note") ?? "").trim().slice(0, 500);
    if (!UUID.test(id) || !["approve", "reject"].includes(decision)) throw new Error("Invalid payment review.");
    if (decision === "approve" && form.get("confirmedCredit") !== "on") throw new Error("Confirm that the money arrived in your bank account before approving.");
    if (decision === "reject" && note.length < 5) throw new Error("Explain why the receipt was rejected (at least 5 characters).");
    const { row } = await reviewManualTransfer(user.id, id, decision as "approve" | "reject", note);
    revalidatePath("/vendor/payment-approvals");
    revalidatePath("/vendor/orders");
    revalidatePath(`/vendor/orders/${row.order_id}`);
    revalidatePath("/account/orders");
    revalidatePath(`/pay/${row.payment_reference}`);
    return { message: decision === "approve" ? "Payment approved. The order is ready to fulfil." : "Receipt rejected. The customer has been notified." };
  } catch (error) { return { error: error instanceof Error ? error.message : "Payment could not be reviewed." }; }
}
