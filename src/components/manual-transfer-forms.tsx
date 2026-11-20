"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Copy, Upload } from "lucide-react";
import { uploadTransferReceiptAction, reviewTransferAction, type TransferState } from "@/app/actions/manual-payments";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";

export function TransferCountdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const seconds = now == null ? null : Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
  return <div className={`rounded-xl border p-3 ${seconds === 0 ? "border-amber-200 bg-amber-50 text-amber-900" : "border-brand-100 bg-brand-50 text-brand-900"}`}>
    <p className="flex items-center gap-2 text-sm font-semibold"><Clock className="size-4" />{seconds == null ? "20-minute payment window" : seconds === 0 ? "Payment window expired" : `Transfer within ${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`}</p>
    {seconds === 0 ? <p className="mt-1 text-xs">Do not make a new transfer. If you already paid, upload your receipt below for the vendor to review. Do not pay twice.</p> : <p className="mt-1 text-xs">Have your receipt of payment ready so you can upload it.</p>}
  </div>;
}

export function CopyAccount({ account }: { account: string }) {
  const [copied, setCopied] = useState(false);
  return <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-800" onClick={async () => { try { await navigator.clipboard.writeText(account); setCopied(true); } catch { setCopied(false); } }}><Copy className="size-3.5" />{copied ? "Copied" : "Copy"}</button>;
}

export function ReceiptUploadForm({ transferId }: { transferId: string }) {
  const [showUpload, setShowUpload] = useState(false);
  const [state, action] = useActionState<TransferState, FormData>(uploadTransferReceiptAction, {});
  return <div className="space-y-3">
    {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
    {state.message ? <Alert tone="success">{state.message}</Alert> : null}
    {!showUpload ? <button type="button" onClick={() => setShowUpload(true)} className="btn-primary w-full"><CheckCircle2 className="size-4" /> I have made payment</button> : <form action={action} className="space-y-3 rounded-xl border border-dashed border-brand-300 bg-brand-50/40 p-4">
      <input type="hidden" name="transferId" value={transferId} />
      <label className="block text-sm font-semibold text-ink-900">Upload your payment receipt<input type="file" name="receipt" accept="image/png,image/jpeg,application/pdf" required className="mt-2 block w-full text-xs" /></label>
      <p className="text-xs text-ink-500">PNG, JPEG or PDF · maximum 2 MB. Only you, the vendor and authorised administrators can view it.</p>
      <SubmitButton className="w-full" pendingLabel="Uploading receipt…"><Upload className="size-4" /> Submit receipt for approval</SubmitButton>
    </form>}
  </div>;
}

export function TransferReviewForm({ transferId }: { transferId: string }) {
  const [state, action] = useActionState<TransferState, FormData>(reviewTransferAction, {});
  return <form action={action} className="space-y-3">
    <input type="hidden" name="transferId" value={transferId} />
    {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
    {state.message ? <Alert tone="success">{state.message}</Alert> : null}
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirmedCredit" className="mt-1" />I have checked my bank account and confirmed this exact amount was received. A receipt alone is not proof of credit.</label>
    <label className="block text-xs font-semibold">Review note (required when rejecting)<textarea name="note" maxLength={500} className="textarea mt-1" rows={2} placeholder="Explain any issue with this receipt…" /></label>
    <div className="flex flex-wrap gap-2"><SubmitButton name="decision" value="approve" pendingLabel="Saving…">Approve payment</SubmitButton><SubmitButton name="decision" value="reject" className="btn-secondary" pendingLabel="Saving…">Reject receipt</SubmitButton></div>
  </form>;
}

export function TransferStatusRefresh() {
  const router = useRouter();
  useEffect(() => { const timer = setInterval(() => { if (!document.hidden) router.refresh(); }, 5000); return () => clearInterval(timer); }, [router]);
  return null;
}
