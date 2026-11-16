import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { listPlatformAnnouncements } from "@/lib/announcements";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { AnnouncementComposer } from "@/components/announcement-forms";
import { AnnouncementList } from "@/components/announcement-list";

export const metadata: Metadata = { title: "Announcements · Admin" };

export default async function AdminAnnouncementsPage() {
  await requireAdmin();
  const items = await listPlatformAnnouncements();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Flash announcements"
        description="Messages that scroll across the top of the screen. Target vendors for operational notices, customers for campaigns, or both."
      />

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader
            title={<span className="flex items-center gap-2"><Megaphone className="size-4 text-brand-600" /> Compose</span>}
            description="Published announcements go live immediately — no deploy."
          />
          <AnnouncementComposer mode="platform" />
        </Card>
        <Card className="xl:col-span-3">
          <CardHeader
            title="Published"
            description={`${items.length} platform announcement${items.length === 1 ? "" : "s"}`}
          />
          <AnnouncementList items={items} showAudience />
        </Card>
      </div>
    </div>
  );
}
