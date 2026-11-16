import { AnnouncementTicker } from "@/components/announcement-ticker";
import { getCustomerTicker, getVendorTicker } from "@/lib/announcements";

/**
 * Server halves of the ticker: they resolve which announcements belong on this
 * surface, then hand the list to the animated client strip.
 */

export async function CustomerAnnouncements({ storeId }: { storeId?: string }) {
  const items = await getCustomerTicker(storeId ?? null);
  return <AnnouncementTicker items={items} />;
}

export async function VendorAnnouncements() {
  const items = await getVendorTicker();
  return <AnnouncementTicker items={items} />;
}
