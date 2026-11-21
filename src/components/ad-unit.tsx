"use client";

import { useEffect } from "react";

interface AdUnitProps {
  /** Ad slot ID from your AdSense account */
  adSlot: string;
  /** Inline styles for the ad container */
  style?: React.CSSProperties;
  /** Optional container class name */
  className?: string;
}

/**
 * Individual AdSense ad unit.
 *
 * Place this component where you want an ad to appear on public pages only.
 * Each ad unit needs a unique data-ad-slot from your AdSense account.
 *
 * Per AdSense policy:
 * - Do not place ads on login, checkout, admin, or dashboard pages
 * - Do not place ads in pop-ups or pop-unders
 * - Do not place ads where they could be confused with site content
 * - Do not encourage users to click ads
 */
export function AdUnit({
  adSlot,
  style = {},
  className,
}: AdUnitProps) {
  useEffect(() => {
    // Request ad render after the script loads
    if (
      typeof window !== "undefined" &&
      (window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle
    ) {
      (window as unknown as { adsbygoogle: unknown[] }).adsbygoogle.push({});
    }
  }, [adSlot]);

  return (
    <ins
      className={className}
      style={{ display: "block", ...style }}
      data-ad-client="ca-pub-8913201913917754"
      data-ad-slot={adSlot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    ></ins>
  );
}
