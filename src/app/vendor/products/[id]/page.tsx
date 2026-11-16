import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { requireActiveVendorContext } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { storeBase } from "@/lib/storefront-base";
import { Alert, PageHeader } from "@/components/ui";
import { ProductForm, type EditableProduct } from "@/components/product-form";
import { ConfirmSubmit } from "@/components/confirm-button";
import { deleteProductAction } from "@/app/actions/vendor";

export const metadata: Metadata = { title: "Edit product · Vendor dashboard" };

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const { store, category } = await requireActiveVendorContext();

  const product = await systemDb.maybeOne<{
    id: string;
    name: string;
    description: string | null;
    short_description: string | null;
    kind: string;
    category_id: string | null;
    price: number;
    compare_at_price: number | null;
    pricing_type: string;
    sku: string | null;
    track_stock: boolean;
    stock_quantity: number;
    is_available: boolean;
    is_featured: boolean;
    condition: string | null;
    brand: string | null;
    model: string | null;
    warranty_info: string | null;
    warranty_months: number | null;
    made_to_order: boolean;
    production_days: number | null;
    prep_time_minutes: number | null;
    portion: string | null;
    service_duration_minutes: number | null;
    attributes: Record<string, string> | null;
    specifications: Record<string, string> | null;
    slug: string;
  }>(`select * from products where id = $1 and store_id = $2`, [id, store.id]);
  if (!product) notFound();

  const [images, variants, addons, categories] = await Promise.all([
    systemDb.query<{ id: string; url: string }>(`select id, url from product_images where product_id = $1 order by sort_order`, [id]),
    systemDb.query<{ name: string; price: string | null; stock_quantity: number; attributes: Record<string, string> | null }>(
      `select name, price, stock_quantity, attributes from product_variants where product_id = $1 order by sort_order`,
      [id],
    ),
    systemDb.query<{ name: string; price: string }>(`select name, price from product_addons where product_id = $1 order by sort_order`, [id]),
    systemDb.query<{ id: string; name: string }>(`select id, name from product_categories where store_id = $1 order by sort_order, name`, [store.id]),
  ]);

  const base = await storeBase(store.slug);

  const editable: EditableProduct = {
    id: product.id,
    name: product.name,
    description: product.description ?? "",
    shortDescription: product.short_description ?? "",
    kind: product.kind,
    categoryId: product.category_id ?? "",
    price: String(Number(product.price)),
    compareAtPrice: product.compare_at_price ? String(Number(product.compare_at_price)) : "",
    pricingType: product.pricing_type,
    sku: product.sku ?? "",
    trackStock: product.track_stock,
    stockQuantity: String(product.stock_quantity),
    isAvailable: product.is_available,
    isFeatured: product.is_featured,
    condition: product.condition ?? "",
    brand: product.brand ?? "",
    model: product.model ?? "",
    warrantyInfo: product.warranty_info ?? "",
    warrantyMonths: product.warranty_months ? String(product.warranty_months) : "",
    madeToOrder: product.made_to_order,
    productionDays: product.production_days ? String(product.production_days) : "",
    prepTimeMinutes: product.prep_time_minutes ? String(product.prep_time_minutes) : "",
    portion: product.portion ?? "",
    serviceDurationMinutes: product.service_duration_minutes ? String(product.service_duration_minutes) : "",
    attributes: product.attributes ?? {},
    specifications: product.specifications ?? {},
    variants: variants.map((variant) => ({
      name: variant.name,
      price: variant.price ? String(Number(variant.price)) : "",
      stockQuantity: String(variant.stock_quantity),
      attributes: variant.attributes ?? {},
    })),
    addons: addons.map((addon) => ({ name: addon.name, price: String(Number(addon.price)) })),
    images,
  };

  return (
    <div>
      <PageHeader
        title={product.name}
        description="Update pricing, availability and category details. Changes appear on your storefront immediately."
        breadcrumb={<Link href="/vendor/products" className="hover:text-brand-700">← Products</Link>}
        actions={
          <Link href={`${base}/products/${product.slug}`} target="_blank" className="btn btn-secondary btn-sm">
            View on storefront <ExternalLink className="size-3.5" />
          </Link>
        }
      />
      {saved ? <Alert tone="success" title="Saved">Your product has been updated.</Alert> : null}
      <div className="mt-4">
        <ProductForm
          product={editable}
          categoryName={category?.name ?? null}
          attributes={category?.attributes ?? []}
          features={category?.features ?? {}}
          categories={categories}
        />
      </div>
      <div className="mt-6 rounded-2xl border border-red-100 bg-white p-4">
        <h2 className="text-sm font-semibold text-ink-900">Delete product</h2>
        <p className="mt-1 text-sm text-ink-500">Permanently removes this product and its uploaded images from the entire site.</p>
        <form action={deleteProductAction} className="mt-3">
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="redirectTo" value="/vendor/products?deleted=1" />
          <ConfirmSubmit message={`Permanently delete “${product.name}” from the site? This cannot be undone.`}>Delete this product</ConfirmSubmit>
        </form>
      </div>
    </div>
  );
}
