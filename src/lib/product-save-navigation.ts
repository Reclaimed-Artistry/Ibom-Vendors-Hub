/** Only navigate to a confirmed product in the current vendor workspace. */
export const PRODUCT_SAVE_NAVIGATION_FIELD = "clientSaveNavigation";

export function productSaveDestination(value: unknown): string | null {
  return typeof value === "string" && /^\/vendor\/products\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\?saved=1$/i.test(value)
    ? value
    : null;
}
