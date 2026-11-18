"use client";

import { useActionState, useState } from "react";
import { ImagePlus, X, Check } from "lucide-react";
import { saveProductAction, type VendorState } from "@/app/actions/vendor";
import type { AdvancedProductForm } from "@/components/product-form";
import { uploadSingleProductImage } from "@/lib/product-image-upload";
import { Alert, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { productGuide, selectionKind, agricultureSelection, descriptionExample, productQuestions } from "@/lib/product-guide";
import { agricultureFieldRequired } from "@/lib/agriculture";
import type { CategoryAttribute } from "@/lib/types";

type Props = Parameters<typeof AdvancedProductForm>[0] & { categorySlug?: string | null };
export function GuidedProductForm({ product, categorySlug, categoryName, attributes, features }: Props) {
  const guide = productGuide(categorySlug);
  const farm = categorySlug === "agriculture-livestock";
  const property = Boolean(features.propertyListings);
  const [state, action] = useActionState<VendorState, FormData>(saveProductAction, {});
  const [selection, setSelection] = useState(product.id ? product.attributes.offering_type || "Other" : "");
  const [kind, setKind] = useState(property ? "service" : product.kind || (guide.service ? "service" : "product"));
  const [values, setValues] = useState<Record<string,string>>(product.attributes ?? {});
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [extra, setExtra] = useState(false);
  const [trackStock, setTrackStock] = useState(product.trackStock);
  const [madeToOrder, setMadeToOrder] = useState(product.madeToOrder);
  const count = product.images.length - removed.length + uploaded.length;
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
  const preserved = {categoryId:product.categoryId,shortDescription:product.shortDescription,compareAtPrice:product.compareAtPrice,pricingType:property?"fixed":product.pricingType,sku:product.sku,condition:product.condition,brand:product.brand,model:product.model,warrantyInfo:product.warrantyInfo,warrantyMonths:product.warrantyMonths,prepTimeMinutes:product.prepTimeMinutes,portion:product.portion,serviceDurationMinutes:product.serviceDurationMinutes};
  return <form action={action} className="mx-auto max-w-3xl space-y-4">
    <input type="hidden" name="productId" value={product.id ?? ""} />
    <input type="hidden" name="attributesJson" value={JSON.stringify({...values,offering_type:selection})} />
    <input type="hidden" name="specificationsJson" value={JSON.stringify(product.specifications)} />
    <input type="hidden" name="variantsJson" value={JSON.stringify(product.variants)} />
    <input type="hidden" name="addonsJson" value={JSON.stringify(product.addons)} />
    <input type="hidden" name="kind" value={kind} />
    {Object.entries(preserved).map(([name,value])=><input key={name} type="hidden" name={name} value={value ?? ""} />)}
    {uploaded.map(url=><input key={url} type="hidden" name="uploadedImageUrls" value={url} />)}
    {removed.map(id=><input key={id} type="hidden" name="removeImage" value={id} />)}
    {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
    {state.fieldErrors ? <Alert tone="warning">{Object.values(state.fieldErrors).join(" · ")}</Alert> : null}
    <section className="card card-pad space-y-3">
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
        <Field label={property ? "Rent / sale price (₦)" : kind === "service" ? "Your price or starting price (₦)" : "Price (₦)"} htmlFor="guide-price" required error={state.fieldErrors?.price}>
          <input id="guide-price" name="price" type="number" min={0} step="0.01" required className="input" defaultValue={product.price} placeholder="e.g. 5000" />
        </Field>
        {kind === "service" && !property ? <p className="text-xs text-ink-500">Use a starting price if the final cost depends on the job, and explain what that price includes in the description.</p> : null}
        {property && selection === "Other" ? <Field label="What type of property?" htmlFor="guide-property-type" required><input id="guide-property-type" className="input" required value={values.property_type ?? ""} onChange={e=>setValues(current=>({...current,property_type:e.target.value}))} placeholder="e.g. Event centre or farmland" /></Field> : null}
        {productQuestions(categorySlug, selection, kind).map(question=><Field key={question.key} label={question.label} htmlFor={`guide-${question.key}`} hint="Optional, but helpful for buyers."><input id={`guide-${question.key}`} className="input" value={values[question.key] ?? ""} maxLength={500} placeholder={question.placeholder} onChange={e=>setValues(current=>({...current,[question.key]:e.target.value}))} /></Field>)}
        {visibleFields.map(field=>fieldInput(field, farm ? agricultureFieldRequired(field.key,values) : Boolean(field.required)))}
      </section>
      <section className="card card-pad space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">3 · Add photos</p>
        <p className="text-xs text-ink-500">Show the actual item or examples of your work. First photo is the cover. Up to 10 photos.</p>
        <div className="flex flex-wrap gap-2">
          {product.images.filter(image=>!removed.includes(image.id)).map(image=><div key={image.id} className="relative"><img src={image.url} alt="Existing listing" className="size-20 rounded-xl object-cover" /><button type="button" aria-label="Remove photo" onClick={()=>setRemoved(current=>[...current,image.id])} className="absolute right-0 top-0 rounded-full bg-white p-1"><X className="size-3" /></button></div>)}
          {uploaded.map(url=><div key={url} className="relative"><img src={url} alt="New listing photo" className="size-20 rounded-xl object-cover" /><button type="button" aria-label="Remove new photo" onClick={()=>setUploaded(current=>current.filter(item=>item!==url))} className="absolute right-0 top-0 rounded-full bg-white p-1"><X className="size-3" /></button></div>)}
        </div>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-ink-300 p-5 text-sm text-brand-800"><ImagePlus className="size-5" />{uploading ? "Uploading photos…" : `Choose photos (${count}/10)`}<input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={uploading || count>=10} onChange={async e=>{
          const files=Array.from(e.target.files ?? []).slice(0,Math.max(0,10-count));e.target.value="";setUploading(true);setUploadError("");
          try { for(const file of files) {const url=await uploadSingleProductImage(file);setUploaded(current=>[...current,url]);} } catch(error) {setUploadError(error instanceof Error?error.message:"Could not upload photo. Please try again.");} finally {setUploading(false);}
        }} /></label>
        {uploadError ? <Alert tone="danger">{uploadError}</Alert> : null}
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
      {uploading ? <button type="button" disabled className="btn-primary opacity-60">Finishing photo upload…</button> : <SubmitButton className="btn-primary w-full sm:w-auto" pendingLabel="Saving…">{product.id ? "Save changes" : property ? "Publish property" : kind === "service" ? "Publish service" : "Publish product"}</SubmitButton>}
    </> : null}
  </form>;
}
