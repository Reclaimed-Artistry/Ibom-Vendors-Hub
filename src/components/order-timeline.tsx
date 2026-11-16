import { Check, Circle, XCircle } from "lucide-react";
import { cn, formatDateTime, titleCase } from "@/lib/utils";
import { workflowFor } from "@/lib/storefront";
import type { StoreCategory } from "@/lib/types";

export function OrderTimeline({
  category,
  history,
  currentStatus,
  compact = false,
}: {
  category: StoreCategory | null;
  history: Array<{ to_status: string; note?: string | null; created_at: string; actor_role?: string }>;
  currentStatus: string;
  compact?: boolean;
}) {
  const workflow = workflowFor(category);
  const reached = new Map<string, { created_at: string; note?: string | null }>();
  for (const entry of history) {
    if (!reached.has(entry.to_status)) reached.set(entry.to_status, entry);
  }
  const cancelled = ["cancelled", "rejected"].includes(currentStatus);
  const currentIndex = workflow.findIndex((stage) => stage.key === currentStatus);

  return (
    <ol className={cn("relative", compact ? "space-y-2" : "space-y-0")}>
      {workflow.map((stage, index) => {
        const done = reached.has(stage.key) || (currentIndex >= 0 && index < currentIndex);
        const entry = reached.get(stage.key);
        const active = stage.key === currentStatus;
        const last = index === workflow.length - 1;
        return (
          <li key={stage.key} className="relative flex gap-4 pb-5 last:pb-0">
            {!last ? (
              <span
                className={cn("absolute left-[13px] top-7 h-full w-0.5", done ? "bg-brand-500" : "bg-ink-100")}
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2",
                done
                  ? "border-brand-600 bg-brand-600 text-white"
                  : active
                    ? "border-brand-600 bg-white text-brand-700"
                    : "border-ink-200 bg-white text-ink-300",
                cancelled && active && "border-red-500 bg-red-500 text-white",
              )}
            >
              {done ? <Check className="size-4" /> : active && cancelled ? <XCircle className="size-4" /> : <Circle className="size-2.5 fill-current" />}
            </span>
            <div className="min-w-0 pb-1">
              <p className={cn("text-sm font-semibold", done || active ? "text-ink-900" : "text-ink-400")}>{stage.label}</p>
              {entry ? <p className="mt-0.5 text-xs text-ink-400">{formatDateTime(entry.created_at)}</p> : null}
              {entry?.note ? <p className="mt-1 text-xs leading-5 text-ink-500">{entry.note}</p> : null}
            </div>
          </li>
        );
      })}
      {!workflow.some((stage) => stage.key === currentStatus) ? (
        <li className="flex gap-4">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-ink-300 bg-white text-ink-400">
            <Circle className="size-3 fill-current" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-900">{titleCase(currentStatus)}</p>
            <p className="text-xs text-ink-400">Current status</p>
          </div>
        </li>
      ) : null}
    </ol>
  );
}
