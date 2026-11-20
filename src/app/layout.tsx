import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./globals-dark.css";
import "./motion.css";
import { CartProvider } from "@/components/cart";
import { SiteMotion } from "@/components/site-motion";
import { ThemeProvider } from "@/components/theme-provider";
import { BRAND_ICONS } from "@/lib/brand-assets";
import { PUBLIC_ROBOTS, SITE_DESCRIPTION, siteUrl, siteVerification } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    default: "Ibom Vendors Hub — Every business. One address.",
    template: "%s · Ibom Vendors Hub",
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(siteUrl()),
  robots: PUBLIC_ROBOTS,
  verification: siteVerification(),
  openGraph: {
    title: "Ibom Vendors Hub",
    description: "Every Akwa Ibom business, one address. Shop, book and track orders from verified local vendors.",
    type: "website",
    locale: "en_NG",
    siteName: "Ibom Vendors Hub",
    images: [
      {
        url: "/brand/og-image.png",
        width: 1200,
        height: 630,
        alt: "Ibom Vendors Hub — One Hub. Every Business. Endless Opportunities.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/brand/og-image.png"],
  },
  applicationName: "Ibom Vendors Hub",
  icons: BRAND_ICONS,
};

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#065f46",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="w-full max-w-full overflow-x-clip" data-theme="system">
      <body className="w-full max-w-full overflow-x-clip">
        <ThemeProvider storageKey="ivh-theme">
          <CartProvider>{children}</CartProvider>
          <SiteMotion />
        </ThemeProvider>
      </body>
    </html>
  );
}
