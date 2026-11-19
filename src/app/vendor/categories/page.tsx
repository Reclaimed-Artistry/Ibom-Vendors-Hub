import type { Metadata } from "next";
import Link from "next/link";
import { Tags } from "lucide-react";
import { requireActiveVendorContext } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { CategoryForm } from "@/components/vendor-forms";
import { ConfirmSubmit } from "@/components/confirm-button";
import { deleteProductCategoryAction } from "@/app/actions/vendor";

export const metadata: Metadata = { title: "Categories · Vendor dashboard" };

export default async function VendorCategoriesPage() {
  const { store, categories: businessCategories } = await requireActiveVendorContext();
  const rows = await systemDb.query<{ id: string; name: string; product_count: number; is_active: boolean }>(
    `select c.id, c.name, c.is_active,
            (select count(*)::int from products p where p.category_id = c.id) as product_count
       from product_categories c where c.store_id = $1 order by c.sort_order, c.name`,
    [store.id],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Catalogue sections"
        description={`Group your catalogue so customers can browse ${store.name} by section.`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Your catalogue sections" description={`${rows.length} section${rows.length === 1 ? "" : "s"}`} />
            {rows.length === 0 ? (
              <EmptyState icon={<Tags className="size-5" />} title="No categories yet" description="Create categories such as “Soups”, “Bridal” or “Phone accessories”." />
            ) : (
              <ul className="divide-y divide-ink-100">
                {rows.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink-900">{row.name}</p>
                      <p className="text-xs text-ink-400">
                        {row.product_count} product{row.product_count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={row.is_active ? "success" : "neutral"}>{row.is_active ? "Visible" : "Hidden"}</Badge>
                      <Link href={`/vendor/products?category=${row.id}`} className="btn btn-ghost btn-sm">View products</Link>
                      <form action={deleteProductCategoryAction}>
                        <input type="hidden" name="categoryId" value={row.id} />
                        <ConfirmSubmit message={`Delete “${row.name}”? Its products become uncategorised.`}>Delete</ConfirmSubmit>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Add a category" />
            <CategoryForm />
          </Card>

          <Card className="card-pad space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Marketplace business categories</p>
            <div className="flex flex-wrap gap-1.5">{businessCategories.map(category => <Badge key={category.id} tone="info">{category.name}</Badge>)}</div>
            <p className="text-sm text-ink-500">Your store appears in all of these business categories. Each listing chooses its own marketplace category and fields, separate from the catalogue sections here.</p>
            <Link href="/vendor/store#categorySlug" className="btn btn-secondary btn-sm">Manage business categories</Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
