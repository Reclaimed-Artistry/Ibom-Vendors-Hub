import type { Metadata } from "next";
import Link from "next/link";
import { requireActiveVendorContext } from "@/lib/auth";
import { getStoreCategories } from "@/lib/storefront";
import { systemDb } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ProductForm } from "@/components/product-form";

export const metadata: Metadata = { title: "New product · Vendor dashboard" };

export default async function NewProductPage() {
  const { store, category, categories: businessCategories } = await requireActiveVendorContext();
  const marketplaceCategories = await getStoreCategories();
  const categories = await systemDb.query<{ id: string; name: string }>(
    `select id, name from product_categories where store_id = $1 order by sort_order, name`,
    [store.id],
  );

  return (
    <div>
      <PageHeader
        title={businessCategories.length > 1 ? "Add a product or service" : category?.slug === "house-agents-realtors" ? "Add a property" : "Add a product"}
        description="Choose what you are adding, then fill in a few simple details. Examples will guide you."
        breadcrumb={<Link href="/vendor/products" className="hover:text-brand-700">← Products</Link>}
      />
      <ProductForm vendorLga={store.city} categorySlug={category?.slug ?? null}
        categoryName={category?.name ?? null}
        attributes={category?.attributes ?? []}
        features={category?.features ?? {}}
        categories={categories}
        marketplaceCategories={marketplaceCategories}
        businessCategoryIds={businessCategories.map(item => item.id)}
        product={{
          name: "",
          description: "",
          shortDescription: "",
          kind: "product",
          categoryId: "",
          marketplaceCategoryId: category?.id ?? "",
          price: "",
          compareAtPrice: "",
          pricingType: "fixed",
          sku: "",
          trackStock: false,
          stockQuantity: "0",
          isAvailable: true,
          isFeatured: false,
          condition: "",
          brand: "",
          model: "",
          warrantyInfo: "",
          warrantyMonths: "",
          madeToOrder: false,
          productionDays: "",
          prepTimeMinutes: category?.features?.prepTime ? "30" : "",
          portion: "",
          serviceDurationMinutes: "",
          attributes: {},
          specifications: {},
          variants: [],
          addons: [],
          images: [],
        }}
      />
    </div>
  );
}
