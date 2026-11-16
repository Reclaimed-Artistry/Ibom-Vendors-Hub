import type { Metadata } from "next";
import Link from "next/link";
import { requireActiveVendorContext } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ProductForm } from "@/components/product-form";

export const metadata: Metadata = { title: "New product · Vendor dashboard" };

export default async function NewProductPage() {
  const { store, category } = await requireActiveVendorContext();
  const categories = await systemDb.query<{ id: string; name: string }>(
    `select id, name from product_categories where store_id = $1 order by sort_order, name`,
    [store.id],
  );

  return (
    <div>
      <PageHeader
        title="Add a product"
        description="Only the fields that matter to your category are shown."
        breadcrumb={<Link href="/vendor/products" className="hover:text-brand-700">← Products</Link>}
      />
      <ProductForm
        categoryName={category?.name ?? null}
        attributes={category?.attributes ?? []}
        features={category?.features ?? {}}
        categories={categories}
        product={{
          name: "",
          description: "",
          shortDescription: "",
          kind: "product",
          categoryId: "",
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
