import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Tags } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { AdminCategoryForm } from "@/components/admin-forms";
import { ConfirmSubmit } from "@/components/confirm-button";
import { toggleCategoryAction } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Categories & feature flags · Admin" };

export default async function AdminCategoriesPage() {
  await requireAdmin();
  const rows = await systemDb.query<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    icon: string | null;
    is_active: boolean;
    sort_order: number;
    features: Record<string, boolean>;
    stores: number;
    products: number;
  }>(
    `select c.id, c.slug, c.name, c.description, c.icon, c.is_active, c.sort_order, c.features,
            (select count(*)::int from store_category_assignments a where a.category_id = c.id) as stores,
            (select count(*)::int from products p join stores s2 on s2.id = p.store_id where coalesce(p.marketplace_category_id, s2.category_id) = c.id) as products
       from store_categories c order by c.sort_order, c.name`,
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Categories & feature flags"
        description="Each category switches on its own workflows and fields without redeploying the app."
        actions={<Link href="#new-category" className="btn btn-primary btn-sm"><Plus className="size-3.5" /> New category</Link>}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          {rows.map((category) => {
            const enabled = Object.entries(category.features ?? {}).filter(([, on]) => on).map(([key]) => key);
            return (
              <Card key={category.id}>
                <CardHeader
                  title={<span className="flex items-center gap-2"><Tags className="size-4 text-brand-600" /> {category.name}</span>}
                  description={`/${category.slug} · ${category.stores} stores · ${category.products} products`}
                  action={
                    <div className="flex items-center gap-2">
                      <Badge tone={category.is_active ? "success" : "neutral"}>{category.is_active ? "active" : "hidden"}</Badge>
                      <form action={toggleCategoryAction}>
                        <input type="hidden" name="categoryId" value={category.id} />
                        <input type="hidden" name="active" value={category.is_active ? "false" : "true"} />
                        <ConfirmSubmit message={`${category.is_active ? "Hide" : "Activate"} ${category.name}?`} className="btn btn-ghost btn-sm">
                          {category.is_active ? "Hide" : "Activate"}
                        </ConfirmSubmit>
                      </form>
                      <Link href={`/admin/categories/${category.slug}`} className="btn btn-secondary btn-sm">Edit</Link>
                    </div>
                  }
                />
                <div className="card-pad space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {enabled.length === 0 ? <span className="text-sm text-ink-500">No features enabled yet.</span> : null}
                    {enabled.map((feature) => <span key={feature} className="badge badge-info">{feature}</span>)}
                  </div>
                  {category.description ? <p className="text-sm text-ink-500">{category.description}</p> : null}
                </div>
              </Card>
            );
          })}
        </div>

        <Card id="new-category">
          <CardHeader title="Create a category" />
          <div className="card-pad">
            <AdminCategoryForm />
          </div>
        </Card>
      </div>
    </div>
  );
}
