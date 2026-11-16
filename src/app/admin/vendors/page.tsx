import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Search } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { storefrontUrl } from "@/lib/domains";
import { formatDate } from "@/lib/utils";
import { Badge, EmptyState, PageHeader, Pagination, Tabs } from "@/components/ui";
import { ReviewCountdown } from "@/components/review-countdown";

export const metadata: Metadata = { title: "Vendors · Admin" };

const PAGE_SIZE = 20;

export default async function AdminVendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  await requireAdmin();
  const { status = "all", q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? 1) || 1);

  const params: unknown[] = [];
  const filters: string[] = [];
  if (status !== "all") {
    params.push(status);
    filters.push(`s.status = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    filters.push(`(s.name ilike $${params.length} or s.slug ilike $${params.length} or u.email ilike $${params.length} or u.full_name ilike $${params.length})`);
  }
  const where = filters.length ? `where ${filters.join(" and ")}` : "";

  const [rows, count] = await Promise.all([
    systemDb.query<{
      id: string;
      name: string;
      slug: string;
      status: string;
      visibility: string;
      owner_name: string;
      owner_email: string;
      category_name: string | null;
      plan_name: string | null;
      expires_at: string | null;
      product_count: number;
      order_count: number;
      created_at: string;
      review_deadline_at: string | null;
    }>(
      `select s.id, s.name, s.slug, s.status, s.visibility, u.full_name as owner_name, u.email as owner_email,
              c.name as category_name, p.name as plan_name, sub.expires_at,
              (select count(*)::int from products pr where pr.store_id = s.id) as product_count,
              (select count(*)::int from orders o where o.store_id = s.id) as order_count,
              s.created_at, s.review_deadline_at
         from stores s
         join users u on u.id = s.owner_id
         left join store_categories c on c.id = s.category_id
         left join lateral (
           select sp.name, sb.expires_at from subscriptions sb join subscription_plans sp on sp.id = sb.plan_id
            where sb.store_id = s.id and sb.status in ('trialing','active') order by sb.expires_at desc limit 1
         ) p on true
         left join lateral (
           select sb.expires_at from subscriptions sb
            where sb.store_id = s.id and sb.status in ('trialing','active') order by sb.expires_at desc limit 1
         ) sub on true
        ${where}
        order by s.created_at desc
        limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`,
      params,
    ),
    systemDb.one<{ count: number }>(
      `select count(*)::int as count from stores s join users u on u.id = s.owner_id ${where}`,
      params,
    ),
  ]);

  const totalPages = Math.max(1, Math.ceil(count.count / PAGE_SIZE));
  const buildHref = (target: number) => {
    const query = new URLSearchParams();
    if (status !== "all") query.set("status", status);
    if (q) query.set("q", q);
    query.set("page", String(target));
    return `/admin/vendors?${query.toString()}`;
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Vendors" description="Every storefront on the platform. Suspension never deletes data." />

      <Tabs
        links={[
          { href: "/admin/vendors", label: "All", active: status === "all" },
          { href: "/admin/vendors?status=pending", label: "Pending", active: status === "pending" },
          { href: "/admin/vendors?status=active", label: "Active", active: status === "active" },
          { href: "/admin/vendors?status=expired", label: "Expired", active: status === "expired" },
          { href: "/admin/vendors?status=suspended", label: "Suspended", active: status === "suspended" },
          { href: "/admin/vendors?status=rejected", label: "Rejected", active: status === "rejected" },
        ]}
      />

      <form className="card card-pad flex flex-wrap items-end gap-3" action="/admin/vendors">
        <input type="hidden" name="status" value={status} />
        <label className="min-w-56 flex-1">
          <span className="label">Search vendors</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <input name="q" defaultValue={q ?? ""} className="input pl-9" placeholder="Store, slug, owner name or email" />
          </span>
        </label>
        <button type="submit" className="btn btn-secondary">Search</button>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={<Building2 className="size-5" />} title="No vendors match" description="Try a different filter or search." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Store</th>
                <th>Owner</th>
                <th>Category</th>
                <th>Plan</th>
                <th className="text-center">Products</th>
                <th className="text-center">Orders</th>
                <th>Status</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((store) => (
                <tr key={store.id}>
                  <td>
                    <Link href={`/admin/vendors/${store.id}`} className="font-semibold text-ink-900 hover:text-brand-700">{store.name}</Link>
                    <p className="text-xs text-ink-400">{storefrontUrl(store.slug)}</p>
                  </td>
                  <td>
                    <p className="text-sm text-ink-800">{store.owner_name}</p>
                    <p className="text-xs text-ink-400">{store.owner_email}</p>
                  </td>
                  <td className="text-sm">{store.category_name ?? "—"}</td>
                  <td className="text-sm">
                    {store.plan_name ?? "—"}
                    {store.expires_at ? <p className="text-xs text-ink-400">ends {formatDate(store.expires_at)}</p> : null}
                  </td>
                  <td className="text-center text-sm">{store.product_count}</td>
                  <td className="text-center text-sm">{store.order_count}</td>
                  <td>
                    <Badge tone={store.status === "active" ? "success" : store.status === "pending" ? "warning" : store.status === "expired" ? "neutral" : "danger"}>{store.status}</Badge>
                    {store.status === "pending" ? (
                      <div className="mt-1">
                        <ReviewCountdown deadlineAt={store.review_deadline_at} createdAt={store.created_at} compact />
                      </div>
                    ) : null}
                    {store.visibility === "unlisted" ? <p className="mt-1 text-[11px] text-ink-400">unlisted</p> : null}
                  </td>
                  <td className="text-xs text-ink-500">{formatDate(store.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} buildHref={buildHref} /> : null}
    </div>
  );
}
