/**
 * Announcement vocabulary shared by the server queries and the client
 * composer/ticker. Deliberately free of database imports so it can be pulled
 * into client bundles.
 */

export type AnnouncementKind = "info" | "warning" | "success" | "flash_sale" | "clearance";
export type AnnouncementAudience = "vendors" | "customers" | "everyone";

export interface AnnouncementProduct {
  id: string;
  name: string;
  slug: string;
}

export interface Announcement {
  id: string;
  scope: "platform" | "store";
  store_id: string | null;
  audience: AnnouncementAudience;
  kind: AnnouncementKind;
  title: string;
  message: string;
  link_url: string | null;
  cta_label: string | null;
  is_active: boolean;
  priority: number;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  products: AnnouncementProduct[];
}

export const ANNOUNCEMENT_KINDS: Array<{ value: AnnouncementKind; label: string; hint: string }> = [
  { value: "flash_sale", label: "Flash sale", hint: "Limited-time price drop" },
  { value: "clearance", label: "Clearance", hint: "Clearing stock" },
  { value: "warning", label: "Warning", hint: "Something needs attention" },
  { value: "info", label: "Announcement", hint: "General news" },
  { value: "success", label: "Good news", hint: "Restock, reopening, milestone" },
];

export function isAnnouncementKind(value: string): value is AnnouncementKind {
  return ANNOUNCEMENT_KINDS.some((kind) => kind.value === value);
}
