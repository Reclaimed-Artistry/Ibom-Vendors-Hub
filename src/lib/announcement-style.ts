import { AlertTriangle, BadgePercent, CheckCircle2, Info, Megaphone, Tag } from "lucide-react";
import type { AnnouncementKind } from "@/lib/announcement-kinds";

/**
 * How each kind of announcement looks on the strip. Shared by the ticker, the
 * composer preview and the management lists, so it lives in a plain module
 * (client and server both read it directly).
 */
export const ANNOUNCEMENT_STYLES: Record<
  AnnouncementKind,
  { bar: string; icon: typeof Info; label: string }
> = {
  flash_sale: {
    bar: "bg-gradient-to-r from-orange-600 via-rose-500 to-orange-600 text-white",
    icon: BadgePercent,
    label: "Flash sale",
  },
  clearance: {
    bar: "bg-gradient-to-r from-brand-800 via-emerald-600 to-brand-800 text-white",
    icon: Tag,
    label: "Clearance",
  },
  warning: {
    bar: "bg-gradient-to-r from-amber-300 via-amber-200 to-amber-300 text-amber-950",
    icon: AlertTriangle,
    label: "Notice",
  },
  success: {
    bar: "bg-gradient-to-r from-emerald-700 via-emerald-500 to-emerald-700 text-white",
    icon: CheckCircle2,
    label: "Update",
  },
  info: {
    bar: "bg-gradient-to-r from-ink-900 via-ink-800 to-ink-900 text-white",
    icon: Megaphone,
    label: "Announcement",
  },
};
