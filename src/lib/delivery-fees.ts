/** Product fees are per unit. A store fallback is charged once for any unpriced products. */
export function calculateDeliveryFee(items: Array<{ kind: string; quantity: number; deliveryFee?: number | null }>, storeFee: number): number {
  let total = 0;
  let needsFallback = false;
  for (const item of items) {
    if (item.kind === "service") continue;
    if (item.deliveryFee == null) needsFallback = true;
    else total += Number(item.deliveryFee) * item.quantity;
  }
  return Number((total + (needsFallback ? Number(storeFee) : 0)).toFixed(2));
}

/** Match the LGA, not an address substring: Uyo must not match another LGA. */
export function isWithinVendorLga(vendorLga: string | null | undefined, deliveryLga: string, deliveryState: string): boolean {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  const state = normalize(deliveryState).replace(/ state$/, "");
  return Boolean(vendorLga?.trim()) && state === "akwa ibom" && normalize(vendorLga ?? "") === normalize(deliveryLga);
}

export function deliveryRate(within: boolean, withinFee: number | null | undefined, outsideFee: number | null | undefined): number | null {
  const fee = within ? withinFee : outsideFee;
  return fee == null ? null : Number(fee);
}
