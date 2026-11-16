import { Pause, Play, Trash2 } from "lucide-react";
import { Badge, EmptyState } from "@/components/ui";
import { ConfirmSubmit } from "@/components/confirm-button";
import { ANNOUNCEMENT_STYLES } from "@/lib/announcement-style";
import type { Announcement } from "@/lib/announcement-kinds";
import { deleteAnnouncementAction, toggleAnnouncementAction } from "@/app/actions/announcements";
import { cn } from "@/lib/utils";

function when(item: Announcement) {
  const start = new Date(item.starts_at);
  const end = item.ends_at ? new Date(item.ends_at) : null;
  const fmt = (date: Date) =>
    date.toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const now = Date.now();
  const live = item.is_active && start.getTime() <= now && (!end || end.getTime() > now);
  const state = !item.is_active ? "paused" : live ? "live" : end && end.getTime() <= now ? "expired" : "scheduled";
  return {
    live,
    state,
    label: `${fmt(start)}${end ? ` → ${fmt(end)}` : " · no end"}`,
  };
}

export function AnnouncementList({
  items,
  showAudience = false,
}: {
  items: Announcement[];
  showAudience?: boolean;
}) {
  if (!items.length) {
    return (
      <EmptyState
        title="Nothing published yet"
        description="Whatever you publish here travels across the top of the screen for the people you choose."
      />
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const style = ANNOUNCEMENT_STYLES[item.kind] ?? ANNOUNCEMENT_STYLES.info;
        const Icon = style.icon;
        const status = when(item);
        return (
          <li key={item.id} className="rounded-xl border border-ink-200 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold", style.bar)}>
                    <Icon className="size-3" aria-hidden /> {style.label}
                  </span>
                  <Badge tone={status.state === "live" ? "success" : status.state === "paused" ? "warning" : "neutral"}>
                    {status.state}
                  </Badge>
                  {showAudience ? (
                    <Badge tone="info">
                      {item.audience === "vendors" ? "vendors" : item.audience === "customers" ? "customers" : "everyone"}
                    </Badge>
                  ) : null}
                  <span className="text-ink-500">{status.label}</span>
                </div>
                <p className="font-semibold text-ink-900">{item.title}</p>
                <p className="text-sm text-ink-600">{item.message}</p>
                {item.products.length ? (
                  <p className="flex flex-wrap gap-1 pt-0.5">
                    {item.products.map((product) => (
                      <span key={product.id} className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-800">
                        {product.name}
                      </span>
                    ))}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                <form action={toggleAnnouncementAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="active" value={item.is_active ? "false" : "true"} />
                  <button type="submit" className="btn btn-ghost btn-sm" title={item.is_active ? "Pause" : "Resume"}>
                    {item.is_active ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                    <span className="sr-only">{item.is_active ? "Pause" : "Resume"}</span>
                  </button>
                </form>
                <form action={deleteAnnouncementAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <ConfirmSubmit message={`Delete “${item.title}”?`} className="btn btn-ghost btn-sm text-red-600">
                    <Trash2 className="size-3.5" />
                    <span className="sr-only">Delete</span>
                  </ConfirmSubmit>
                </form>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
