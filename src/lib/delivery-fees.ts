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
