import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import type { CategoryAttribute, CategoryFeatures, WorkflowStage } from "@/lib/types";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { AdminCategoryForm } from "@/components/admin-forms";

export const metadata: Metadata = { title: "Edit category · Admin" };

export default async function AdminCategoryEditPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await params;
  const category = await systemDb.maybeOne<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    icon: string | null;
    sort_order: number;
    features: CategoryFeatures;
    attributes: CategoryAttribute[];
    workflow: WorkflowStage[];
    is_active: boolean;
  }>(`select * from store_categories where slug = $1`, [slug]);
  if (!category) notFound();

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Edit ${category.name}`}
        description="Feature flags, custom attributes and the order workflow for every store in this category."
        breadcrumb={<Link href="/admin/categories" className="hover:text-brand-700">← Categories</Link>}
      />
      <Card className="max-w-4xl">
        <CardHeader title="Category configuration" description="Changes apply to all stores in this category immediately." />
        <div className="card-pad">
          <AdminCategoryForm
            category={{
              id: category.id,
              name: category.name,
              slug: category.slug,
              description: category.description ?? "",
              icon: category.icon ?? "",
              sortOrder: category.sort_order,
              features: (category.features ?? {}) as Record<string, boolean>,
              attributes: category.attributes ?? [],
              workflow: category.workflow ?? [],
              isActive: category.is_active,
            }}
          />
        </div>
      </Card>
    </div>
  );
}
