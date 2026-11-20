"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin, getCurrentUser, getVendorContext, vendorSuspensionMessage } from "@/lib/auth";
import { systemDb, isUniqueViolation } from "@/lib/db";
import { logActivity } from "@/lib/audit";
import { isAnnouncementKind } from "@/lib/announcements";

/**
 * Publishing flash / splash announcements.
 *
 * Admin publishes platform-wide (to vendors, to shoppers, or both). A vendor
 * publishes to the shoppers of their own store and may attach the products they
 * are flashing. Every write clears the "announcements" cache tag so the ticker
 * changes on the next paint instead of waiting for its TTL.
 */

export interface AnnouncementState {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
}

const MAX_PRODUCTS = 12;

interface Parsed {
  kind: string;
  title: string;
  message: string;
  linkUrl: string | null;
  ctaLabel: string | null;
  audience: "vendors" | "customers" | "everyone";
  endsAt: string | null;
  products: string[];
}

function parse(formData: FormData, allowedAudiences: Parsed["audience"][]): { error?: string; value?: Parsed } {
  const str = (key: string) => String(formData.get(key) ?? "").trim();
  const kind = str("kind") || "info";
  const title = str("title");
  const message = str("message");
  const audience = (str("audience") || "customers") as Parsed["audience"];
  const linkUrl = str("linkUrl");
  const ctaLabel = str("ctaLabel");
  const endsAtRaw = str("endsAt");
  const products = formData
    .getAll("productIds")
    .map((value) => String(value))
    .filter(Boolean)
    .slice(0, MAX_PRODUCTS);

  if (!isAnnouncementKind(kind)) return { error: "Pick one of the announcement types." };
  if (title.length < 3) return { error: "Give the announcement a short headline (at least 3 characters)." };
  if (title.length > 80) return { error: "Keep the headline under 80 characters so it reads in one sweep." };
  if (message.length < 3) return { error: "Add a line of detail — it scrolls after the headline." };
  if (message.length > 220) return { error: "Keep the detail under 220 characters." };
  if (!allowedAudiences.includes(audience)) return { error: "Choose who should see this." };

  if (linkUrl) {
    const ok = linkUrl.startsWith("/") || /^https?:\/\//i.test(linkUrl);
    if (!ok) return { error: "Links must start with / (a page on this site) or https://." };
  }

  let endsAt: string | null = null;
  if (endsAtRaw) {
    const parsed = new Date(endsAtRaw);
    if (Number.isNaN(parsed.getTime())) return { error: "That end date could not be read." };
    if (parsed.getTime() < Date.now()) return { error: "The end date is in the past — the ticker would never show it." };
    endsAt = parsed.toISOString();
  }

  return {
    value: {
      kind,
      title,
      message,
      linkUrl: linkUrl || null,
      ctaLabel: ctaLabel ? ctaLabel.slice(0, 30) : null,
      audience,
      endsAt,
      products,
    },
  };
}

async function insertAnnouncement(input: {
  scope: "platform" | "store";
  storeId: string | null;
  parsed: Parsed;
  createdBy: string;
}) {
  const { parsed } = input;
  const row = await systemDb.one<{ id: string }>(
    `insert into announcements
       (scope, store_id, audience, kind, title, message, link_url, cta_label, ends_at, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     returning id`,
    [
      input.scope,
      input.storeId,
      parsed.audience,
      parsed.kind,
      parsed.title,
      parsed.message,
      parsed.linkUrl,
      parsed.ctaLabel,
      parsed.endsAt,
      input.createdBy,
    ],
  );

  if (parsed.products.length && input.storeId) {
    // Only products that actually belong to this store can be flashed.
    const owned = await systemDb.query<{ id: string }>(
      `select id from products where store_id = $1 and id = any($2::uuid[])`,
      [input.storeId, parsed.products],
    );
    const ids = owned.map((product) => product.id);
    if (ids.length) {
      await systemDb.execute(
        `insert into announcement_products (announcement_id, product_id)
         select $1, unnest($2::uuid[]) on conflict do nothing`,
        [row.id, ids],
      );
    }
  }
  return row.id;
}

/** Admin → vendors and/or shoppers. */
export async function createPlatformAnnouncementAction(
  _prev: AnnouncementState,
  formData: FormData,
): Promise<AnnouncementState> {
  const user = await requireAdmin();
  const { error, value } = parse(formData, ["vendors", "customers", "everyone"]);
  if (error || !value) return { error };

  try {
    const id = await insertAnnouncement({ scope: "platform", storeId: null, parsed: value, createdBy: user.id });
    await logActivity({
      actorId: user.id,
      actorRole: "admin",
      action: "announcement.published",
      entityType: "announcement",
      entityId: id,
      description: `${value.kind}: ${value.title} → ${value.audience}`,
      meta: { audience: value.audience, kind: value.kind },
    });
  } catch (caught) {
    return { error: caught instanceof Error ? caught.message : "The announcement could not be saved." };
  }

  revalidateTag("announcements");
  revalidatePath("/admin/announcements");
  revalidatePath("/", "layout");
  return { message: "Published. It is live in the ticker already." };
}

/** Vendor → the shoppers of their store. */
export async function createStoreAnnouncementAction(
  _prev: AnnouncementState,
  formData: FormData,
): Promise<AnnouncementState> {
  const context = await getVendorContext();
  const lockError = vendorSuspensionMessage(context);
  if (lockError) return { error: lockError };
  const { error, value } = parse(formData, ["customers"]);
  if (error || !value) return { error };

  try {
    const id = await insertAnnouncement({
      scope: "store",
      storeId: context.store.id,
      parsed: { ...value, audience: "customers" },
      createdBy: context.user.id,
    });
    await logActivity({
      actorId: context.user.id,
      actorRole: "vendor",
      storeId: context.store.id,
      action: "announcement.published",
      entityType: "announcement",
      entityId: id,
      description: `${value.kind}: ${value.title}`,
      meta: { kind: value.kind, products: value.products.length },
    });
  } catch (caught) {
    return { error: caught instanceof Error ? caught.message : "The announcement could not be saved." };
  }

  revalidateTag("announcements");
  revalidatePath("/vendor/announcements");
  revalidatePath(`/s/${context.store.slug}`, "layout");
  return { message: "Live on your storefront now." };
}

/** Pause/resume without losing the wording, for either kind of author. */
export async function toggleAnnouncementAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  const row = await systemDb.maybeOne<{ scope: string; store_id: string | null; created_by: string | null }>(
    `select scope, store_id, created_by from announcements where id = $1`,
    [id],
  );
  if (!row) return;

  const user = await getCurrentUser();
  if (!user) return;
  const isAdmin = user.role === "admin" || user.role === "super_admin";
  let allowed = isAdmin;
  if (!allowed && row.scope === "store" && row.store_id) {
    const ctx = await getVendorContext();
    if (vendorSuspensionMessage(ctx)) return;
    allowed = ctx.store.id === row.store_id;
  }
  if (!allowed) return;

  await systemDb.execute(`update announcements set is_active = $2 where id = $1`, [id, active]);
  await logActivity({
    actorId: user.id,
    actorRole: isAdmin ? "admin" : "vendor",
    action: active ? "announcement.resumed" : "announcement.paused",
    entityType: "announcement",
    entityId: id,
  });
  revalidateTag("announcements");
  revalidatePath("/admin/announcements");
  revalidatePath("/vendor/announcements");
}

export async function deleteAnnouncementAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const row = await systemDb.maybeOne<{ scope: string; store_id: string | null }>(
    `select scope, store_id from announcements where id = $1`,
    [id],
  );
  if (!row) return;

  const user = await getCurrentUser();
  if (!user) return;
  const isAdmin = user.role === "admin" || user.role === "super_admin";
  let allowed = isAdmin;
  if (!allowed && row.scope === "store" && row.store_id) {
    const ctx = await getVendorContext();
    if (vendorSuspensionMessage(ctx)) return;
    allowed = ctx.store.id === row.store_id;
  }
  if (!allowed) return;

  try {
    await systemDb.execute(`delete from announcements where id = $1`, [id]);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  await logActivity({
    actorId: user.id,
    actorRole: isAdmin ? "admin" : "vendor",
    action: "announcement.deleted",
    entityType: "announcement",
    entityId: id,
  });
  revalidateTag("announcements");
  revalidatePath("/admin/announcements");
  revalidatePath("/vendor/announcements");
}
