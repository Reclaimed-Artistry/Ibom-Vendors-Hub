"use client";

import { useActionState, useRef, useState, type FormEvent } from "react";
import { saveProductAction, type VendorState } from "@/app/actions/vendor";
import { productSaveDestination } from "@/lib/product-save-navigation";

/** Keep native HTML actions, but do not stream a router tree to confirm a save. */
export function useProductSubmission() {
  const [nativeState, action, nativePending] = useActionState<VendorState, FormData>(saveProductAction, {});
  const [clientState, setClientState] = useState<VendorState>();
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const state = clientState ?? nativeState;
  const redirecting = Boolean(productSaveDestination(state.redirectUrl));

  function submit(event: FormEvent<HTMLFormElement>, mediaBusy: boolean) {
    event.preventDefault();
    if (mediaBusy || inFlight.current || redirecting) return;
    const data = new FormData(event.currentTarget);
    const fields: Array<[string, string]> = [];
    for (const [name, value] of data.entries()) {
      if (name.startsWith("$ACTION_")) continue;
      if (typeof value !== "string") {
        if (value.size) { setClientState({ error: "Finish uploading files using the media picker before saving." }); return; }
        continue;
      }
      fields.push([name, value]);
    }
    inFlight.current = true;
    setPending(true);
    setClientState({});
    void (async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 60_000);
      let confirmed = false;
      try {
        const response = await fetch("/api/vendor-products", {
          method: "POST", credentials: "same-origin", redirect: "error",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fields), signal: controller.signal,
        });
        const result = await response.json() as VendorState;
        if (response.ok && productSaveDestination(result.redirectUrl)) {
          confirmed = true;
          setClientState(result);
        } else {
          setClientState({ error: result.error || "Could not save this listing. Check the details and try again.", fieldErrors: result.fieldErrors });
        }
      } catch {
        // Never retry a POST automatically: it may already have committed.
        setClientState({ error: "Could not confirm the save. Check your Products list before trying again." });
      } finally {
        window.clearTimeout(timeout);
        inFlight.current = confirmed;
        setPending(false);
      }
    })();
  }

  return { state, action, submit, saving: pending || nativePending, redirecting };
}
