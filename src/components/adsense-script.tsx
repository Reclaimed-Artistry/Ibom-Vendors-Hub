"use client";

import Head from "next/head";

/**
 * AdSense main script.
 *
 * Per Google AdSense policy, this script must be placed in the <head> of
 * every page where ads are displayed. It loads asynchronously and does not
 * block page rendering.
 *
 * Placed only on public-facing pages (site + storefronts), NOT on:
 * - Admin panel (/admin/*)
 * - Vendor dashboard (/vendor/*)
 * - Auth pages (/login, /register, etc.)
 * - User account pages (/account/*)
 * - Checkout/cart pages
 */
export function AdSenseScript() {
  return (
    <Head>
      <script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8913201913917754"
        crossOrigin="anonymous"
      />
    </Head>
  );
}
