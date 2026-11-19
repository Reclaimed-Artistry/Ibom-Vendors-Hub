"use client";

import { Field } from "@/components/ui";
import { isArtisanCategorySlug } from "@/lib/artisan-bookings";
import { categorySlugs } from "@/lib/category-policy";
import type { StoreCategory } from "@/lib/types";

type CategoryOption = Pick<StoreCategory, "id" | "slug" | "name"> & { is_active?: boolean };

export function BusinessCategoryFields({ categories, primary, selected, onPrimaryChange, onSelectedChange, error, className = "" }: {
  categories: CategoryOption[];
  primary: string;
  selected: string[];
  onPrimaryChange: (slug: string) => void;
  onSelectedChange: (slugs: string[]) => void;
  error?: string;
  className?: string;
}) {
  const chosen = categorySlugs(primary, selected);
  return <div className="space-y-3">
    {chosen.map(slug => <input key={slug} type="hidden" name="categorySlugs" value={slug} />)}
    <Field label="Primary business category" htmlFor="categorySlug" required error={error}
      hint="Your main business. You can select additional categories below, and choose the right category for each listing.">
      <select id="categorySlug" name="categorySlug" required value={primary} className={`select${className}`} onChange={event => onPrimaryChange(event.target.value)}>
        <option value="" disabled>Choose your main business or trade…</option>
        <optgroup label="Nigerian Artisans & Technical Trades">
          {categories.filter(category => isArtisanCategorySlug(category.slug)).map(category => <option key={category.id} value={category.slug} disabled={category.is_active === false && category.slug !== primary}>{category.name}{category.is_active === false ? " (hidden)" : ""}</option>)}
        </optgroup>
        <optgroup label="Retail, Food, Fashion & Professional Services">
          {categories.filter(category => !isArtisanCategorySlug(category.slug)).map(category => <option key={category.id} value={category.slug} disabled={category.is_active === false && category.slug !== primary}>{category.name}{category.is_active === false ? " (hidden)" : ""}</option>)}
        </optgroup>
      </select>
    </Field>
    <fieldset className="rounded-xl border border-ink-200 p-3">
      <legend className="px-1 text-sm font-semibold text-ink-800">Additional business categories (optional)</legend>
      <p className="mb-3 text-xs text-ink-500">Sell clothes and also do branding &amp; packaging? Select both. Your store can be found in every category you choose.</p>
      <div className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {categories.map(category => <label key={category.id} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-xs ${chosen.includes(category.slug) ? "border-brand-300 bg-brand-50 text-brand-900" : "border-ink-100 text-ink-700"}`}>
          <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-brand-700" checked={chosen.includes(category.slug)} disabled={category.slug === primary}
            onChange={event => onSelectedChange(event.target.checked ? [...chosen, category.slug] : chosen.filter(slug => slug !== category.slug))} />
          <span>{category.name}{category.slug === primary ? <span className="ml-1 text-brand-700">(primary)</span> : null}</span>
        </label>)}
      </div>
      <p className="mt-2 text-xs text-ink-500" aria-live="polite">{chosen.length} {chosen.length === 1 ? "category" : "categories"} selected. To remove your primary category, choose another primary first.</p>
    </fieldset>
  </div>;
}

export function MarketplaceCategoryField({ categories, assignedIds, value, onChange, error }: {
  categories: CategoryOption[];
  assignedIds: string[];
  value: string;
  onChange: (id: string) => void;
  error?: string;
}) {
  const assigned = categories.filter(category => assignedIds.includes(category.id));
  const others = categories.filter(category => !assignedIds.includes(category.id));
  const options = (items: CategoryOption[]) => items.map(category => <option key={category.id} value={category.id}>{category.name}{category.is_active === false ? " (existing listing only)" : ""}</option>);
  return <Field label="Marketplace category for this listing" htmlFor="marketplaceCategoryId" required error={error}
    hint="Choose the category that fits this product or service. Choosing a new category also adds it to your store when you save. Catalogue sections are managed separately.">
    <select id="marketplaceCategoryId" name="marketplaceCategoryId" className="select" required value={value} onChange={event => onChange(event.target.value)}>
      <option value="" disabled>Choose a marketplace category…</option>
      {assigned.length ? <optgroup label="Your business categories">{options(assigned)}</optgroup> : null}
      {others.length ? <optgroup label="Other categories — add a new business line">{options(others)}</optgroup> : null}
    </select>
  </Field>;
}
