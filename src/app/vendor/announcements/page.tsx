import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { requireActiveVendorContext } from "@/lib/auth";
import { listStoreAnnouncements } from "@/lib/announcements";
import { systemDb } from "@/lib/db";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { AnnouncementComposer } from "@/components/announcement-forms";
import { AnnouncementList } from "@/components/announcement-list";

export const metadata: Metadata = { title: "Announcements · Vendor" };

export default async function VendorAnnouncementsPage() {
  const { store } = await requireActiveVendorContext();
  const [items, products] = await Promise.all([
    listStoreAnnouncements(store.id),
    systemDb.query<{ id: string; name: string }>(
      `select id, name from products where store_id = $1 and is_available order by name limit 200`,
      [store.id],
    ),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Flash announcements"
        description="Put a message on your storefront ticker — flash sales, clearance, restocks — and pick the products to feature in it."
      />

      <div className="grid gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader
            title={<span className="flex items-center gap-2"><Megaphone className="size-4 text-brand-600" /> Compose</span>}
            description="Shown to shoppers on your storefront, under the header."
          />
          <div className="card-pad">
            <AnnouncementComposer mode="store" products={products} />
          </div>
        </Card>
        <Card className="xl:col-span-3">
          <CardHeader
            title="Published"
            description={`${items.length} storefront announcement${items.length === 1 ? "" : "s"}`}
          />
          <div className="card-pad">
            <AnnouncementList items={items} />
          </div>
        </Card>
      </div>
    </div>
  );
}
