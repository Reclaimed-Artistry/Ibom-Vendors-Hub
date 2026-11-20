import type { CategoryFeatures, Product, StoreCategory } from "@/lib/types";

export function categorySlugs(primary: string, additional: string[] = []) {
  return [...new Set([primary, ...additional].map((slug) => slug.trim()).filter(Boolean))];
}

/** A listing's category, NOT the union of its store's business categories. */
export function listingCategory(product: Pick<Product, "marketplace_category">, fallback?: StoreCategory | null) {
  return product.marketplace_category ?? fallback ?? null;
}

/** Navigation/discovery only. Never use this union to authorise a transaction. */
export function storeFeatures(categories: StoreCategory[], fallback?: StoreCategory | null): CategoryFeatures {
  const result: Record<string, boolean> = {};
  for (const category of categories.length ? categories : fallback ? [fallback] : []) {
    for (const [key, enabled] of Object.entries(category.features ?? {})) result[key] = Boolean(result[key] || enabled);
  }
  return result;
}

export function directBooking(product: Pick<Product, "kind" | "marketplace_category">, fallback?: StoreCategory | null) {
  const features = listingCategory(product, fallback)?.features;
  return (product.kind === "service" || Boolean(features?.serviceBooking)) && !features?.inquiryOnly && !features?.propertyListings;
}

export function listingActionLabel(product: Pick<Product, "marketplace_category">, fallback?: StoreCategory | null) {
  const features = listingCategory(product, fallback)?.features;
  return features?.inquiryOnly ? "View & enquire →" : features?.propertyListings ? "View property →" : "Book now →";
}
