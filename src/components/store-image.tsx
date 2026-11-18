"use client";

import { useState } from "react";

/** Consistent placeholders for absent, blank or broken vendor branding. */
export function StoreImage({ src, kind, alt = "", className }: {
  src?: string | null;
  kind: "cover" | "logo";
  alt?: string;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const fallback = kind === "cover"
    ? "/brand/store-cover-placeholder.svg"
    : "/brand/store-avatar-placeholder.svg";
  const source = src?.trim();
  return (
    <img
      src={source && failedSrc !== source ? source : fallback}
      alt={alt}
      className={className}
      onError={() => { if (source) setFailedSrc(source); }}
    />
  );
}
