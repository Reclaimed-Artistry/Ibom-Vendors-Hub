import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CartProvider } from "@/components/cart";

export const metadata: Metadata = {
  title: {
    default: "Ibom Vendors Hub — Every business. One address.",
    template: "%s · Ibom Vendors Hub",
  },
  description:
    "Ibom Vendors Hub is the multi-vendor marketplace for Akwa Ibom businesses. Discover restaurants, fashion designers, shoemakers, electronics stores and professional services — each with its own storefront.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "Ibom Vendors Hub",
    description: "Every Akwa Ibom business, one address. Shop, book and track orders from verified local vendors.",
    type: "website",
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
};

// Every page renders tenant-scoped, per-request data (the storefront host header,
// the signed-in user, live catalogue rows). Rendering them on demand keeps one
// tenant's HTML from being cached and served to another, and keeps the build from
// depending on database availability.
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#065f46",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
