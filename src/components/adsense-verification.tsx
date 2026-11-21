"use client";

import Head from "next/head";

/**
 * AdSense site verification meta tag.
 *
 * Google AdSense requires you to verify site ownership before ads can serve.
 * Google provides a verification meta tag like:
 *   <meta name="google-adsense-verification" content="XXXXXXXXXXXXXXXX" />
 *
 * Set ADSENSE_VERIFICATION_CODE in your environment variables with the
 * content value Google gives you, and this component will place the tag
 * in the <head> of every public page.
 *
 * Once verified, you can remove this component or leave it — having it
 * present does not affect ad serving after verification.
 */
export function AdSenseVerification() {
  const code = process.env.ADSENSE_VERIFICATION_CODE;
  if (!code) return null;

  return (
    <Head>
      <meta name="google-adsense-verification" content={code} />
    </Head>
  );
}
