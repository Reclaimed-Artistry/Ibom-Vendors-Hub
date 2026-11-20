"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";

export function MarkNotificationRead({ id, action }: { id: string; action: (id: string) => Promise<void> }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => { await action(id); })}
      className="text-xs font-semibold text-brand-700 hover:text-brand-900"
    >
      <Check className="mr-1 inline size-3" />
      Mark read
    </button>
  );
}
