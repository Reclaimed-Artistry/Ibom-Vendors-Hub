import type { Metadata, Viewport } from "next";
import Script from "next/script";
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

        {/* Analytics & error tracking — configure IDs in Vercel env vars */}
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
        )}
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <Script id="ga-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}');
            `}
          </Script>
        )}
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
          <Script
            defer
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
            strategy="afterInteractive"
          />
        )}
        {process.env.NEXT_PUBLIC_SENTRY_DSN && (
          <Script
            id="sentry-init"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                (function(){
                  var Sentry = window.Sentry || (window.Sentry = {});
                  Sentry.init({
                    dsn: '${process.env.NEXT_PUBLIC_SENTRY_DSN}',
                    environment: '${process.env.NODE_ENV ?? 'production'}',
                    tracesSampleRate: 0.1,
                    replaysSessionSampleRate: 0.1,
                    replaysOnErrorSampleRate: 1.0,
                    integrations: [
                      new Sentry.BrowserTracing(),
                      new Sentry.Replay()
                    ]
                  });
                })();
              `,
            }}
          />
        )}
      </body>
    </html>
  );
}
