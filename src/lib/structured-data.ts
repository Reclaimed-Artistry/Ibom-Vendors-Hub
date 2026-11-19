import { mediaKind } from "@/lib/product-media";
import type { Product, Store, StoreCategory } from "@/lib/types";
import { seoDescription, SITE_DESCRIPTION, SITE_NAME, siteUrl, storeUrl } from "@/lib/seo";

function webUrl(value: string | null | undefined, base = siteUrl()) {
  if (!value) return undefined;
  try {
    const url = new URL(value, base);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function websiteStructuredData(supportEmail: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": siteUrl("/#organization"),
        name: SITE_NAME,
        alternateName: "Ibomvendorshub",
        url: siteUrl(),
        logo: { "@type": "ImageObject", url: siteUrl("/brand/icon-512.png"), width: 512, height: 512 },
        email: supportEmail,
        areaServed: { "@type": "State", name: "Akwa Ibom", containedInPlace: { "@type": "Country", name: "Nigeria" } },
      },
      {
        "@type": "WebSite",
        "@id": siteUrl("/#website"),
        name: SITE_NAME,
        alternateName: "Ibomvendorshub",
        url: siteUrl(),
        description: SITE_DESCRIPTION,
        inLanguage: "en-NG",
        publisher: { "@id": siteUrl("/#organization") },
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: siteUrl("/browse?q={search_term_string}").replace(/%7B/g, "{").replace(/%7D/g, "}") },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

export function storeStructuredData(store: Store, category: StoreCategory | null) {
  const url = storeUrl(store.slug);
  const days: Record<string, string> = {
    monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday",
    friday: "Friday", saturday: "Saturday", sunday: "Sunday",
  };
  const hours = Object.entries(store.operating_hours ?? {}).flatMap(([day, value]) => {
    if (!days[day.toLowerCase()] || value.closed || !/^\d{2}:\d{2}$/.test(value.open) || !/^\d{2}:\d{2}$/.test(value.close)) return [];
    return [{ "@type": "OpeningHoursSpecification", dayOfWeek: `https://schema.org/${days[day.toLowerCase()]}`, opens: value.open, closes: value.close }];
  });
  return {
    "@context": "https://schema.org",
    "@type": store.address ? "LocalBusiness" : "Organization",
    "@id": `${url}#business`,
    name: store.name,
    url,
    description: seoDescription(store.description || store.tagline, `${store.name} offers ${category?.name.toLowerCase() ?? "products and services"} in ${store.city || "Akwa Ibom"}, Nigeria.`),
    ...(store.address || store.city || store.state ? {
      address: {
        "@type": "PostalAddress",
        streetAddress: store.address || undefined,
        addressLocality: store.city || undefined,
        addressRegion: store.state || undefined,
        addressCountry: store.country === "Nigeria" ? "NG" : store.country,
      },
    } : {}),
    ...(store.phone ? { telephone: store.phone } : {}),
    ...(store.email ? { email: store.email } : {}),
    ...(store.logo_url ? { logo: webUrl(store.logo_url, url) } : {}),
    ...(store.cover_url || store.logo_url ? { image: webUrl(store.cover_url || store.logo_url, url) } : {}),
    ...(webUrl(store.website) ? { sameAs: [webUrl(store.website)] } : {}),
    ...(store.address && hours.length ? { openingHoursSpecification: hours } : {}),
  };
}

export function breadcrumbStructuredData(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: item.url })),
  };
}

export function productStructuredData(product: Product, store: Store, category: StoreCategory | null) {
  category = product.marketplace_category ?? category;
  const url = storeUrl(store.slug, `/products/${encodeURIComponent(product.slug)}`);
  const service = product.kind === "service";
  const images = (product.images ?? []).filter(image => mediaKind(image) === "image").map((image) => webUrl(image.url, url)).filter(Boolean);
  const price = Number(product.price);
  // A quotation/starting price, property price or enquiry is not a purchasable
  // fixed-price offer. Never manufacture a zero price, stock, review or rating.
  const hasOffer = product.pricing_type === "fixed" && Number.isFinite(price) && price >= 0
    && /^[A-Z]{3}$/.test(product.currency) && !category?.features?.inquiryOnly && !category?.features?.propertyListings;
  const seller = { "@type": "Organization", "@id": `${storeUrl(store.slug)}#business`, name: store.name, url: storeUrl(store.slug) };
  return {
    "@context": "https://schema.org",
    "@type": service ? "Service" : "Product",
    "@id": `${url}#${service ? "service" : "product"}`,
    url,
    name: product.name,
    description: seoDescription(product.description || product.short_description, `${product.name} from ${store.name}.`, 5000),
    ...(images.length ? { image: images } : {}),
    ...(category ? { category: category.name } : {}),
    ...(service ? { provider: seller } : {
      ...(product.sku ? { sku: product.sku } : {}),
      ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    }),
    ...(hasOffer ? {
      offers: {
        "@type": "Offer",
        url,
        price: price.toFixed(2),
        priceCurrency: product.currency,
        availability: `https://schema.org/${!product.is_available || !store.accepts_orders || (product.track_stock && product.stock_quantity <= 0 && !product.made_to_order) ? "OutOfStock" : product.made_to_order ? "PreOrder" : "InStock"}`,
        ...(product.condition && !service ? { itemCondition: `https://schema.org/${product.condition === "used" ? "UsedCondition" : product.condition === "refurbished" ? "RefurbishedCondition" : "NewCondition"}` } : {}),
        seller,
      },
    } : {}),
    ...(!service && product.rating_count > 0 && product.rating_avg >= 1 && product.rating_avg <= 5 ? {
      aggregateRating: { "@type": "AggregateRating", ratingValue: product.rating_avg, reviewCount: product.rating_count, bestRating: 5, worstRating: 1 },
    } : {}),
  };
}
