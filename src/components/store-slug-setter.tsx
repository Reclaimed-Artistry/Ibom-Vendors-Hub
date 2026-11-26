"use client";

import { useEffect } from "react";

/**
 * Sets document.documentElement.dataset.storeSlug so the VisitBeacon can
 * attribute visits to the correct store even when the storefront is accessed
 * via a subdomain (where window.location.pathname is '/', not '/s/{slug}').
 */
export function StoreSlugSetter({ slug }: { slug: string }) {
  useEffect(() => {
    document.documentElement.dataset.storeSlug = slug;
    return () => {
      delete document.documentElement.dataset.storeSlug;
    };
  }, [slug]);

  return null;
}
