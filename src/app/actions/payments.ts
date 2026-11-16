"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { confirmSandboxPayment, verifyPayment, failPayment } from "@/lib/payments";
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
    await failPayment(reference, error instanceof Error ? error.message : "Sandbox confirmation failed");
    redirect(`/pay/callback?reference=${encodeURIComponent(reference)}&error=1`);
  }
  redirect(`/pay/callback?reference=${encodeURIComponent(reference)}`);
}

export async function verifyPaymentAction(formData: FormData) {
  const reference = String(formData.get("reference") ?? "");
  if (!reference) throw new Error("Missing payment reference");
  try {
    const result = await verifyPayment(reference);
    redirect(`/pay/callback?reference=${encodeURIComponent(reference)}&status=${result.status}`);
  } catch (error) {
    await failPayment(reference, error instanceof Error ? error.message : "Verification failed");
    redirect(`/pay/callback?reference=${encodeURIComponent(reference)}&error=1`);
  }
}
