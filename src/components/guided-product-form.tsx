"use client";

import { MarketplaceCategoryField } from "@/components/business-category-fields";
import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { saveProductAction, type VendorState } from "@/app/actions/vendor";
import type { AdvancedProductForm } from "@/components/product-form";
import { ProductMediaUploader } from "@/components/product-media-uploader";
import { Alert, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { productGuide, selectionKind, agricultureSelection, descriptionExample, productQuestions } from "@/lib/product-guide";
import { agricultureFieldRequired } from "@/lib/agriculture";
import type { CategoryAttribute } from "@/lib/types";

type Props = Parameters<typeof AdvancedProductForm>[0] & { categorySlug?: string | null };
export function GuidedProductForm({ product, categorySlug: defaultSlug, categoryName: defaultName, attributes: defaultAttributes, features: defaultFeatures, marketplaceCategories, businessCategoryIds }: Props) {
  const [marketplaceCategoryId, setMarketplaceCategoryId] = useState(product.marketplaceCategoryId ?? "");
  const category = marketplaceCategories.find(item => item.id === marketplaceCategoryId);
  const categorySlug = category?.slug ?? defaultSlug;
  const categoryName = category?.name ?? defaultName;
  const attributes = category?.attributes ?? defaultAttributes;
  const features = category?.features ?? defaultFeatures;
  const [pricingType, setPricingType] = useState(product.pricingType);
  const guide = productGuide(categorySlug);
  const farm = categorySlug === "agriculture-livestock";
  const property = Boolean(features.propertyListings);
  const [state, action] = useActionState<VendorState, FormData>(saveProductAction, {});
  const [selection, setSelection] = useState(product.id ? product.attributes.offering_type || "Other" : "");
  const [kind, setKind] = useState(property ? "service" : product.kind || (guide.service ? "service" : "product"));
  const [values, setValues] = useState<Record<string,string>>(product.attributes ?? {});
  const [mediaBusy, setMediaBusy] = useState(false);
  const [extra, setExtra] = useState(false);
  const [trackStock, setTrackStock] = useState(product.trackStock);
  const [madeToOrder, setMadeToOrder] = useState(product.madeToOrder);
  const example = descriptionExample(categorySlug, selection);
  // Required property disclosures remain visible. Other category details are optional.
  const visibleFields = attributes.filter(field => {
    if (farm) return ["sale_unit","pack_size","produce_condition"].includes(field.key) || agricultureFieldRequired(field.key, values) && field.key !== "produce_type";
    if (property) return field.required && field.key !== "property_type";
    return false;
  });
  const optionalFields = attributes.filter(field => !visibleFields.includes(field) && !(farm && field.key === "produce_type") && !(property && field.key === "property_type"));
  function fieldInput(field: CategoryAttribute, required = false) {
    const value=values[field.key] ?? "";
    const update=(next:string)=>setValues(current=>({...current,[field.key]:next}));
    return <Field key={field.key} label={field.label} htmlFor={`guide-${field.key}`} required={required}>
      {field.type === "select" ? <select id={`guide-${field.key}`} className="select" value={value} required={required} onChange={e=>update(e.target.value)}><option value="">Choose…</option>{field.options?.map(option=><option key={option}>{option}</option>)}</select>
        : field.type === "textarea" ? <textarea id={`guide-${field.key}`} className="textarea" rows={2} value={value} required={required} maxLength={2000} onChange={e=>update(e.target.value)} placeholder="A short, clear answer is enough." />
        : field.type === "boolean" ? <select id={`guide-${field.key}`} className="select" value={value} onChange={e=>update(e.target.value)}><option value="">Not specified</option><option value="true">Yes</option><option value="false">No</option></select>
        : <input id={`guide-${field.key}`} className="input" type={field.type === "number" ? "number" : "text"} min={field.type === "number" ? 0 : undefined} value={value} required={required} onChange={e=>update(e.target.value)} placeholder={field.key === "pack_size" ? "e.g. 1 kg pack or crate of 30 eggs" : undefined} />}
    </Field>;
  }
  const preserved = {categoryId:product.categoryId,shortDescription:product.shortDescription,compareAtPrice:product.compareAtPrice,pricingType:features.inquiryOnly?"quotation":property?"fixed":pricingType,sku:product.sku,condition:product.condition,brand:product.brand,model:product.model,warrantyInfo:product.warrantyInfo,warrantyMonths:product.warrantyMonths,prepTimeMinutes:product.prepTimeMinutes,portion:product.portion,serviceDurationMinutes:product.serviceDurationMinutes};
  return <form action={action} onSubmit={event => { if (mediaBusy) event.preventDefault(); }} className="mx-auto max-w-3xl space-y-4">
    <input type="hidden" name="productId" value={product.id ?? ""} />
    <input type="hidden" name="attributesJson" value={JSON.stringify({...values,offering_type:selection})} />
    <input type="hidden" name="specificationsJson" value={JSON.stringify(product.specifications)} />
    <input type="hidden" name="variantsJson" value={JSON.stringify(product.variants)} />
    <input type="hidden" name="addonsJson" value={JSON.stringify(product.addons)} />
    <input type="hidden" name="kind" value={kind} />
    {Object.entries(preserved).map(([name,value])=><input key={name} type="hidden" name={name} value={value ?? ""} />)}
    {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
    {state.fieldErrors ? <Alert tone="warning">{Object.values(state.fieldErrors).join(" · ")}</Alert> : null}
    <section className="card card-pad space-y-3">
      <MarketplaceCategoryField categories={marketplaceCategories} assignedIds={businessCategoryIds} value={marketplaceCategoryId}
        error={state.fieldErrors?.marketplaceCategoryId} onChange={id => {
          const next = marketplaceCategories.find(item => item.id === id);
          setMarketplaceCategoryId(id);
          // Keep the basic form mounted so unsaved descriptions/photos survive.
          setSelection(current => current || product.id ? "Other" : "");
          setKind(next?.features?.propertyListings || productGuide(next?.slug).service ? "service" : "product");
          setPricingType(next?.features?.inquiryOnly ? "quotation" : "fixed");
        }} />
      <p className="text-xs text-ink-500">The guide below follows this listing’s category. Your basic details and media are kept when you change it; review category details before saving.</p>
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">1 · {categoryName || "Your store"}</p>
      <Field label={property ? "What property do you want to list?" : "What do you want to add?"} htmlFor="offering" required>
        <select id="offering" className="select" required value={selection} onChange={e=>{
          const next=e.target.value;setSelection(next);setKind(property ? "service" : farm ? "product" : selectionKind(next,guide));
          setValues(current=>({...current,...(farm ? {produce_type:agricultureSelection(next)} : {}),...(property ? {property_type:next === "Other" ? "" : next} : {})}));
        }}><option value="">Choose a product or service…</option>{guide.choices.map(choice=><option key={choice}>{choice}</option>)}<option>Other</option></select>
      </Field>
      <p className="text-xs text-ink-500">Choose the closest match, or Other. You will give it your own name below.</p>
    </section>
    {selection ? <>
      <section className="card card-pad space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">2 · Tell buyers about it</p>
        <Field label="What is its name?" htmlFor="guide-name" required error={state.fieldErrors?.name}>
          <input id="guide-name" name="name" className="input" defaultValue={product.name} required minLength={2} maxLength={160} placeholder={`e.g. ${selection === "Other" ? "Give your item a clear name" : selection}`} />
        </Field>
        {selection === "Other" && !farm && !property ? <Field label="Is it an item or a service?" htmlFor="guide-kind"><select id="guide-kind" className="select" value={kind} onChange={e=>setKind(e.target.value)}><option value="product">An item customers buy</option><option value="service">A service customers book</option></select></Field> : null}
        <Field label="Tell buyers what they will get" htmlFor="guide-description" hint="A few sentences are enough. Use your own details; the example is only a guide.">
          <textarea id="guide-description" name="description" className="textarea min-h-28" defaultValue={product.description} maxLength={6000} rows={4} placeholder="What is included? What size or quantity? When will it be ready?" />
        </Field>
        <aside className="rounded-xl border border-brand-100 bg-brand-50/60 p-3 text-xs leading-relaxed text-ink-600"><strong className="text-brand-800">Example:</strong> {example}</aside>
        <Field label={features.inquiryOnly ? "Guide price (₦, optional)" : property ? "Rent / sale price (₦)" : kind === "service" ? "Your price or starting price (₦)" : "Price (₦)"} htmlFor="guide-price" required={!features.inquiryOnly} error={state.fieldErrors?.price}>
          <input id="guide-price" name="price" type="number" min={0} step="0.01" required={!features.inquiryOnly} className="input" defaultValue={product.price} placeholder="e.g. 5000" />
        </Field>
        {features.inquiryOnly ? <p className="rounded-xl bg-brand-50 p-3 text-xs text-brand-900">Customers send an enquiry for a quotation. Dates, availability and final terms must be confirmed directly with you; this is not an instant reservation.</p> : null}
        {kind === "service" && !property ? <p className="text-xs text-ink-500">Use a starting price if the final cost depends on the job, and explain what that price includes in the description.</p> : null}
        {property && selection === "Other" ? <Field label="What type of property?" htmlFor="guide-property-type" required><input id="guide-property-type" className="input" required value={values.property_type ?? ""} onChange={e=>setValues(current=>({...current,property_type:e.target.value}))} placeholder="e.g. Event centre or farmland" /></Field> : null}
        {productQuestions(categorySlug, selection, kind).map(question=><Field key={question.key} label={question.label} htmlFor={`guide-${question.key}`} hint="Optional, but helpful for buyers."><input id={`guide-${question.key}`} className="input" value={values[question.key] ?? ""} maxLength={500} placeholder={question.placeholder} onChange={e=>setValues(current=>({...current,[question.key]:e.target.value}))} /></Field>)}
        {visibleFields.map(field=>fieldInput(field, farm ? agricultureFieldRequired(field.key,values) : Boolean(field.required)))}
      </section>
      <section className="card card-pad space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">3 · Add photos, GIFs, videos or audio</p>
        <ProductMediaUploader existing={product.images} onBusyChange={setMediaBusy} />
      </section>
      <section className="card card-pad space-y-4">
        <button type="button" aria-expanded={extra} onClick={()=>setExtra(!extra)} className="flex w-full items-center justify-between text-sm font-semibold text-ink-700">Optional details <span>{extra ? "−" : "+"}</span></button>
        <p className="text-xs text-ink-500">You can skip these. Delivery uses your store settings unless you change it below.</p>
        <div className={extra ? "space-y-4" : "hidden"}>
          {kind === "product" ? <div className="grid gap-3 sm:grid-cols-2"><Field label="Delivery within your LGA (₦ per unit)" htmlFor="guide-delivery"><input id="guide-delivery" name="deliveryFee" className="input" type="number" min={0} defaultValue={product.deliveryFee} placeholder="Use store setting" /></Field><Field label="Delivery outside your LGA (₦ per unit)" htmlFor="guide-outside"><input id="guide-outside" name="deliveryFeeOutside" className="input" type="number" min={0} defaultValue={product.deliveryFeeOutside} placeholder="Use store setting" /></Field></div> : null}
          <label className="flex items-center gap-2 text-sm"><input name="trackStock" type="checkbox" checked={trackStock} onChange={e=>setTrackStock(e.target.checked)} />Keep track of how many are in stock</label>
          <Field label="Number in stock" htmlFor="guide-stock"><input id="guide-stock" name="stockQuantity" className="input" type="number" min={0} defaultValue={product.stockQuantity} /></Field>
          {features.madeToOrder || features.productionTracking ? <><label className="flex items-center gap-2 text-sm"><input name="madeToOrder" type="checkbox" checked={madeToOrder} onChange={e=>setMadeToOrder(e.target.checked)} />I make this after an order</label><Field label="Days needed to make it" htmlFor="guide-production"><input id="guide-production" name="productionDays" className="input" type="number" min={0} defaultValue={product.productionDays} /></Field></> : <><input type="hidden" name="madeToOrder" value={product.madeToOrder ? "true" : "false"} /><input type="hidden" name="productionDays" value={product.productionDays} /></>}
          {optionalFields.map(field=>fieldInput(field))}
          <input type="hidden" name="isAvailablePresent" value="1" />
          <label className="flex items-center gap-2 text-sm"><input name="isAvailable" type="checkbox" defaultChecked={product.isAvailable} />Available to customers</label>
          <label className="flex items-center gap-2 text-sm"><input name="isFeatured" type="checkbox" defaultChecked={product.isFeatured} />Highlight on my storefront</label>
        </div>
      </section>
      <p className="flex items-center gap-2 text-xs text-ink-500"><Check className="size-4 text-brand-700" />That’s all. You can edit this listing later.</p>
      {mediaBusy ? <button type="button" disabled className="btn-primary opacity-60">Finishing media upload…</button> : <SubmitButton className="btn-primary w-full sm:w-auto" pendingLabel="Saving…">{product.id ? "Save changes" : property ? "Publish property" : kind === "service" ? "Publish service" : "Publish product"}</SubmitButton>}
    </> : null}
  </form>;
}
