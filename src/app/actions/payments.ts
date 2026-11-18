"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { confirmSandboxPayment, verifyPayment } from "@/lib/payments";
import { logActivity } from "@/lib/audit";

export async function confirmSandboxPaymentAction(formData: FormData) {
  const reference = String(formData.get("reference") ?? "");
  if (!reference) throw new Error("Missing payment reference");
  const user = await getCurrentUser();
  try {
    await confirmSandboxPayment(reference);
    await logActivity({
      actorId: user?.id ?? null,
      actorRole: user?.role ?? "system",
      action: "payment.sandbox_confirmed",
      entityType: "payment",
      entityId: reference,
    });
  } catch (error) {
    void error;
    redirect(`/pay/callback?reference=${encodeURIComponent(reference)}&error=1`);
  }
  redirect(`/pay/callback?reference=${encodeURIComponent(reference)}`);
}

export async function verifyPaymentAction(formData: FormData) {
  const reference = String(formData.get("reference") ?? "");
  if (!reference) throw new Error("Missing payment reference");
  let status: string;
  try {
    const result = await verifyPayment(reference);
    status = result.status;
  } catch {
    // Network/configuration errors do not prove the customer failed to pay.
    redirect(`/pay/callback?reference=${encodeURIComponent(reference)}&error=1`);
  }
  redirect(`/pay/callback?reference=${encodeURIComponent(reference)}&status=${status}`);
}
