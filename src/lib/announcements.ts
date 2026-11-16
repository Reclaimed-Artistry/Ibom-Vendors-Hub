import { unstable_cache } from "next/cache";
import { systemDb } from "@/lib/db";
import type { Announcement } from "@/lib/announcement-kinds";

/**
 * Flash / splash announcements.
 *
 * Admin messages are platform-scoped and aimed at vendors (operational notices,
 * warnings) or at shoppers (flash sales the platform is running). Vendor
 * messages are store-scoped and aimed at that store's shoppers, optionally
 * naming the products that are being flashed.
 *
 * Reads are cached across requests under the "announcements" tag — the ticker
 * sits on every page, so it must not cost a round trip per render — and every
 * write clears the tag.
 *
 * Types and the kind vocabulary live in `announcement-kinds.ts`, which is safe
 * to import from client components.
 */

export type {
  Announcement,
  AnnouncementAudience,
  AnnouncementKind,
  AnnouncementProduct,
} from "@/lib/announcement-kinds";
export { ANNOUNCEMENT_KINDS, isAnnouncementKind } from "@/lib/announcement-kinds";

const LIVE = `a.is_active and a.starts_at <= now() and (a.ends_at is null or a.ends_at > now())`;

const SELECT = `
  select a.*,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'slug', p.slug) order by p.name)
        from announcement_products ap
        join products p on p.id = ap.product_id
       where ap.announcement_id = a.id
    ), '[]'::jsonb) as products
    from announcements a`;

async function query(sql: string, params: unknown[]): Promise<Announcement[]> {
  try {
    return await systemDb.query<Announcement>(sql, params);
  } catch (error) {
    // A ticker must never take a page down with it.
    console.error("announcements unavailable", error);
    return [];
  }
}

const TICKER_LIMIT = 4;

/** Admin → vendors. */
export const getVendorTicker = unstable_cache(
  async () =>
    query(
      `${SELECT} where ${LIVE} and a.scope = 'platform' and a.audience in ('vendors','everyone')
        order by a.priority desc, a.created_at desc limit ${TICKER_LIMIT}`,
      [],
    ),
  ["ticker-vendors"],
  { tags: ["announcements"], revalidate: 30 },
);

/** Admin → shoppers, plus the store's own messages when browsing a storefront. */
export const getCustomerTicker = unstable_cache(
  async (storeId?: string | null) =>
    query(
      `${SELECT} where ${LIVE} and (
          (a.scope = 'platform' and a.audience in ('customers','everyone'))
          or (a.scope = 'store' and a.store_id = $1)
        )
        order by a.priority desc, a.created_at desc limit ${TICKER_LIMIT}`,
      [storeId ?? null],
    ),
  ["ticker-customers"],
  { tags: ["announcements"], revalidate: 30 },
);

/** Everything an admin has published, newest first, for the management screen. */
export async function listPlatformAnnouncements(): Promise<Announcement[]> {
  return query(
    `${SELECT} where a.scope = 'platform' order by a.is_active desc, a.created_at desc limit 50`,
    [],
  );
}

/** Everything a store has published. */
export async function listStoreAnnouncements(storeId: string): Promise<Announcement[]> {
  return query(
    `${SELECT} where a.scope = 'store' and a.store_id = $1 order by a.is_active desc, a.created_at desc limit 50`,
    [storeId],
  );
}
