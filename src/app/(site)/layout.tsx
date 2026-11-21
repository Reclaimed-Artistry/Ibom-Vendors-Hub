import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CustomerAnnouncements } from "@/components/announcement-strip";
import { CartDrawer } from "@/components/cart";
import { AdSenseScript } from "@/components/adsense-script";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full max-w-full flex-col overflow-x-clip">
      <AdSenseScript />
      <SiteHeader />
      <CustomerAnnouncements />
      <main className="min-w-0 flex-1">{children}</main>
      <SiteFooter />
      <CartDrawer />
    </div>
  );
}
