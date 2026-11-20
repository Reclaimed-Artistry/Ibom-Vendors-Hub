"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui";
import { PRODUCT_SAVE_NAVIGATION_FIELD, productSaveDestination } from "@/lib/product-save-navigation";

/**
 * A confirmed save gets a fresh GET of the saved listing. Do not depend on a
 * streamed router redirect that can leave an editor stuck on "Publishing…".
 * The opt-in is added only after hydration: plain HTML/older clients keep the
 * server action's normal 303 redirect. A real link remains if navigation fails.
 */
export function ProductSaveNavigation({ redirectUrl }: { redirectUrl?: string }) {
  const [hydrated, setHydrated] = useState(false);
  const destination = productSaveDestination(redirectUrl);
  useEffect(() => { setHydrated(true); }, []);
  useEffect(() => {
    if (destination) window.location.assign(destination);
  }, [destination]);

  return (
    <>
      {hydrated ? <input type="hidden" name={PRODUCT_SAVE_NAVIGATION_FIELD} value="1" /> : null}
      {destination ? (
        <Alert tone="success" title="Product saved">
          Opening your saved listing… <a href={destination} className="font-semibold underline">Open saved product</a>
        </Alert>
      ) : null}
    </>
  );
}
